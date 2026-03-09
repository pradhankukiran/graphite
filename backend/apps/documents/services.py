"""Business logic for document management and ingestion triggering."""

import logging
import os

from django.db import models, transaction
from django.db.models import Sum

from apps.documents.blob_storage import (
    delete_document_blob,
    is_blob_enabled,
    upload_document_blob,
)
from apps.documents.models import Chunk, Document, IngestionJob
from apps.knowledge_graph.neo4j_client import Neo4jClient

logger = logging.getLogger(__name__)

# Map of file extensions to Document.FileType values
_EXTENSION_MAP = {
    ".pdf": Document.FileType.PDF,
    ".txt": Document.FileType.TXT,
    ".docx": Document.FileType.DOCX,
    ".html": Document.FileType.HTML,
    ".htm": Document.FileType.HTML,
    ".md": Document.FileType.MD,
    ".markdown": Document.FileType.MD,
}


def _detect_file_type(filename: str) -> str:
    """Detect the file type from the filename extension."""
    _, ext = os.path.splitext(filename)
    ext = ext.lower()
    file_type = _EXTENSION_MAP.get(ext)
    if file_type is None:
        raise ValueError(f"Unsupported file type: {ext}")
    return file_type


def create_document(user, file) -> Document:
    """
    Create a Document and its associated IngestionJob from an uploaded file.

    Args:
        user: The authenticated user (accounts.User instance).
        file: The uploaded file (Django UploadedFile).

    Returns:
        The newly created Document instance.
    """
    filename = file.name
    file_type = _detect_file_type(filename)

    with transaction.atomic():
        document = Document.objects.create(
            user=user,
            filename=filename,
            file_type=file_type,
            file=file,
            file_size=file.size,
            status=Document.Status.PENDING,
        )
        IngestionJob.objects.create(
            document=document,
            status=IngestionJob.Status.PENDING,
        )

    if is_blob_enabled():
        try:
            blob_fields = upload_document_blob(document)
        except Exception as exc:
            logger.exception(
                "Failed to upload document %s to Vercel Blob", document.id
            )
            if document.file:
                document.file.delete(save=False)
            document.delete()
            raise RuntimeError(
                f"Failed to upload '{filename}' to Vercel Blob"
            ) from exc

        for field_name, value in blob_fields.items():
            setattr(document, field_name, value)
        document.save(update_fields=[*blob_fields.keys(), "updated_at"])

    return document


def delete_document(document_id: str) -> None:
    """
    Delete a document and all related data (chunks in DB and Neo4j).

    Args:
        document_id: UUID string of the document to delete.
    """
    try:
        document = Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        raise ValueError(f"Document not found: {document_id}")

    # Clean up Neo4j data
    try:
        Neo4jClient.clear_document_data_sync(str(document_id))
    except Exception:
        logger.warning(
            "Failed to clear Neo4j data for document %s", document_id, exc_info=True
        )

    # Delete the file from storage
    if document.file:
        try:
            document.file.delete(save=False)
        except Exception:
            logger.warning(
                "Failed to delete file for document %s", document_id, exc_info=True
            )

    if document.blob_pathname or document.blob_url:
        try:
            delete_document_blob(document)
        except Exception:
            logger.warning(
                "Failed to delete blob for document %s", document_id, exc_info=True
            )

    # Cascade delete removes chunks and ingestion job
    document.delete()


def get_document_stats(user) -> dict:
    """
    Compute aggregate statistics for the given user's documents.

    Returns:
        A dict with keys: total_documents, total_chunks, total_entities,
        status_breakdown.
    """
    qs = Document.objects.filter(user=user)

    total_documents = qs.count()

    aggregates = qs.aggregate(
        total_chunks=Sum("chunk_count"),
        total_entities=Sum("entity_count"),
    )
    total_chunks = aggregates["total_chunks"] or 0
    total_entities = aggregates["total_entities"] or 0

    # Status breakdown: {status_value: count}
    status_breakdown = {}
    status_counts = qs.values("status").annotate(count=models.Count("id"))
    for entry in status_counts:
        status_breakdown[entry["status"]] = entry["count"]

    return {
        "total_documents": total_documents,
        "total_chunks": total_chunks,
        "total_entities": total_entities,
        "status_breakdown": status_breakdown,
    }


def trigger_ingestion(document_id: str) -> str:
    """
    Dispatch the Celery ingestion pipeline for a document.

    Args:
        document_id: UUID string of the document.

    Returns:
        The Celery task ID of the pipeline chain.
    """
    from apps.documents.tasks import run_ingestion_pipeline

    result = run_ingestion_pipeline(document_id)
    return result
