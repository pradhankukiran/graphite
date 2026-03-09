"""Django Ninja API endpoints for the Documents app."""

import logging
from uuid import UUID

from django.http import HttpRequest
from ninja import File, Query, Router, UploadedFile
from ninja.pagination import paginate
from ninja_jwt.authentication import JWTAuth

from apps.core.pagination import PageNumberPagination
from apps.documents.models import Chunk, Document, IngestionJob
from apps.documents.schemas import (
    ChunkOut,
    DocumentFilterParams,
    DocumentListOut,
    DocumentOut,
    DocumentStatsOut,
    DocumentUploadOut,
    IngestionJobOut,
)
from apps.documents.services import (
    create_document,
    delete_document,
    get_document_stats,
    trigger_ingestion,
)

logger = logging.getLogger(__name__)

router = Router(tags=["Documents"], auth=JWTAuth())


@router.get("/", response=list[DocumentListOut])
@paginate(PageNumberPagination)
def list_documents(
    request: HttpRequest,
    filters: DocumentFilterParams = Query(...),
):
    """List documents for the current user with optional filtering."""
    qs = Document.objects.filter(user=request.auth)

    if filters.status:
        qs = qs.filter(status=filters.status)
    if filters.file_type:
        qs = qs.filter(file_type=filters.file_type)
    if filters.search:
        qs = qs.filter(filename__icontains=filters.search)

    return qs


@router.post("/upload", response={201: DocumentUploadOut})
def upload_document(request: HttpRequest, file: UploadedFile = File(...)):
    """Upload a document and trigger the ingestion pipeline."""
    try:
        document = create_document(user=request.auth, file=file)
    except ValueError as exc:
        return 400, {"detail": str(exc)}

    # Trigger the async ingestion pipeline
    try:
        task_id = trigger_ingestion(str(document.id))
        logger.info(
            "Ingestion pipeline triggered for document %s (task %s)",
            document.id,
            task_id,
        )
    except Exception:
        logger.warning(
            "Failed to trigger ingestion for document %s",
            document.id,
            exc_info=True,
        )

    return 201, {
        "document_id": document.id,
        "filename": document.filename,
        "status": document.status,
        "message": "Document uploaded. Ingestion pipeline started.",
    }


@router.get("/stats", response=DocumentStatsOut)
def document_stats(request: HttpRequest):
    """Get aggregate statistics for the current user's documents."""
    stats = get_document_stats(request.auth)
    return stats


@router.get("/{document_id}", response=DocumentOut)
def get_document(request: HttpRequest, document_id: UUID):
    """Get full document details."""
    try:
        document = Document.objects.get(id=document_id, user=request.auth)
    except Document.DoesNotExist:
        return 404, {"detail": "Document not found"}
    return document


@router.delete("/{document_id}", response={204: None})
def remove_document(request: HttpRequest, document_id: UUID):
    """Delete a document and all related data."""
    try:
        document = Document.objects.get(id=document_id, user=request.auth)
    except Document.DoesNotExist:
        return 404, {"detail": "Document not found"}

    delete_document(str(document.id))
    return 204, None


@router.get("/{document_id}/chunks", response=list[ChunkOut])
@paginate(PageNumberPagination)
def list_chunks(request: HttpRequest, document_id: UUID):
    """List chunks for a document (paginated)."""
    try:
        document = Document.objects.get(id=document_id, user=request.auth)
    except Document.DoesNotExist:
        return 404, {"detail": "Document not found"}

    return Chunk.objects.filter(document=document)


@router.get("/{document_id}/status", response=IngestionJobOut)
def get_ingestion_status(request: HttpRequest, document_id: UUID):
    """Get the ingestion job status for a document."""
    try:
        document = Document.objects.get(id=document_id, user=request.auth)
    except Document.DoesNotExist:
        return 404, {"detail": "Document not found"}

    try:
        job = IngestionJob.objects.get(document=document)
    except IngestionJob.DoesNotExist:
        return 404, {"detail": "Ingestion job not found"}

    return job
