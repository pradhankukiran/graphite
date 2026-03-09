"""Celery tasks for the document ingestion pipeline."""

import logging
from datetime import datetime, timezone

from asgiref.sync import async_to_sync
from celery import chain, shared_task
from channels.layers import get_channel_layer
from django.conf import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# WebSocket helper
# ---------------------------------------------------------------------------


def _send_ws_event(document_id: str, event_data: dict) -> None:
    """Send a WebSocket event to the ingestion channel group."""
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        group_name = f"ingestion_{document_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "ingestion.stage_update",
                **event_data,
            },
        )
    except Exception:
        logger.warning(
            "Failed to send WS event for document %s", document_id, exc_info=True
        )


# ---------------------------------------------------------------------------
# IngestionJob helpers
# ---------------------------------------------------------------------------


def _update_job(document_id: str, **kwargs) -> None:
    """Update the IngestionJob for the given document."""
    from apps.documents.models import IngestionJob

    IngestionJob.objects.filter(document__id=document_id).update(**kwargs)


def _add_stage(document_id: str, stage_name: str, status: str, message: str = "") -> None:
    """Add or update a stage entry in the IngestionJob's stages JSON list."""
    from apps.documents.models import IngestionJob

    try:
        job = IngestionJob.objects.get(document__id=document_id)
    except IngestionJob.DoesNotExist:
        return

    now = datetime.now(timezone.utc).isoformat()
    stages = job.stages or []

    # Find existing stage entry or create a new one
    existing = None
    for stage in stages:
        if stage.get("name") == stage_name:
            existing = stage
            break

    if existing:
        existing["status"] = status
        existing["message"] = message
        if status == "running":
            existing["started_at"] = now
        elif status in ("completed", "failed"):
            existing["completed_at"] = now
    else:
        stage_entry = {
            "name": stage_name,
            "status": status,
            "started_at": now if status == "running" else None,
            "completed_at": now if status in ("completed", "failed") else None,
            "message": message,
        }
        stages.append(stage_entry)

    job.stages = stages
    job.current_stage = stage_name
    job.save(update_fields=["stages", "current_stage", "updated_at"])


# ---------------------------------------------------------------------------
# Pipeline tasks
# ---------------------------------------------------------------------------


@shared_task(name="apps.documents.tasks.parse_document_task", queue="ingestion")
def parse_document_task(document_id: str) -> str:
    """
    Parse the document file and extract raw text.

    Updates Document.status to PARSING, then saves extracted text.
    """
    from apps.documents.models import Document
    from apps.documents.blob_storage import open_document_path
    from apps.documents.parsers import parse_document

    logger.info("Parsing document %s", document_id)

    document = Document.objects.get(id=document_id)
    document.status = Document.Status.PARSING
    document.save(update_fields=["status", "updated_at"])

    _update_job(
        document_id,
        status="running",
        current_stage="parsing",
        progress_pct=10,
        started_at=datetime.now(timezone.utc),
    )
    _add_stage(document_id, "parsing", "running")
    _send_ws_event(document_id, {
        "stage": "parsing",
        "status": "running",
        "progress_pct": 10,
    })

    try:
        with open_document_path(document) as file_path:
            raw_text = parse_document(file_path, document.file_type)

        document.raw_text = raw_text
        document.save(update_fields=["raw_text", "updated_at"])

        _add_stage(document_id, "parsing", "completed")
        _update_job(document_id, progress_pct=25)
        _send_ws_event(document_id, {
            "stage": "parsing",
            "status": "completed",
            "progress_pct": 25,
        })

        logger.info(
            "Parsed document %s: %d characters extracted",
            document_id,
            len(raw_text),
        )
    except Exception as exc:
        _mark_failed(document_id, "parsing", str(exc))
        raise

    return document_id


@shared_task(name="apps.documents.tasks.chunk_document_task", queue="ingestion")
def chunk_document_task(document_id: str) -> str:
    """
    Split document text into chunks and persist them.

    Updates Document.status to CHUNKING. Creates Chunk objects in bulk.
    """
    from apps.documents.chunkers import chunk_text
    from apps.documents.models import Chunk, Document

    logger.info("Chunking document %s", document_id)

    document = Document.objects.get(id=document_id)
    document.status = Document.Status.CHUNKING
    document.save(update_fields=["status", "updated_at"])

    _update_job(document_id, current_stage="chunking", progress_pct=30)
    _add_stage(document_id, "chunking", "running")
    _send_ws_event(document_id, {
        "stage": "chunking",
        "status": "running",
        "progress_pct": 30,
    })

    try:
        chunks_data = chunk_text(document.raw_text)

        # Remove existing chunks (in case of retry)
        Chunk.objects.filter(document=document).delete()

        chunk_objects = [
            Chunk(
                document=document,
                index=cd["index"],
                text=cd["text"],
                char_start=cd["char_start"],
                char_end=cd["char_end"],
            )
            for cd in chunks_data
        ]
        Chunk.objects.bulk_create(chunk_objects)

        document.chunk_count = len(chunk_objects)
        document.save(update_fields=["chunk_count", "updated_at"])

        _add_stage(document_id, "chunking", "completed")
        _update_job(document_id, progress_pct=50)
        _send_ws_event(document_id, {
            "stage": "chunking",
            "status": "completed",
            "progress_pct": 50,
            "chunk_count": len(chunk_objects),
        })

        logger.info(
            "Chunked document %s into %d chunks", document_id, len(chunk_objects)
        )
    except Exception as exc:
        _mark_failed(document_id, "chunking", str(exc))
        raise

    return document_id


@shared_task(name="apps.documents.tasks.embed_chunks_task", queue="embedding")
def embed_chunks_task(document_id: str) -> str:
    """
    Embed all chunks and store them in Neo4j with their embeddings.

    Updates Document.status to EMBEDDING. Creates Chunk nodes and NEXT_CHUNK
    relationships in Neo4j.
    """
    from apps.documents.models import Chunk, Document
    from apps.knowledge_graph.neo4j_client import Neo4jClient
    from apps.retrieval.embeddings import EmbeddingService

    logger.info("Embedding chunks for document %s", document_id)

    document = Document.objects.get(id=document_id)
    document.status = Document.Status.EMBEDDING
    document.save(update_fields=["status", "updated_at"])

    _update_job(document_id, current_stage="embedding", progress_pct=55)
    _add_stage(document_id, "embedding", "running")
    _send_ws_event(document_id, {
        "stage": "embedding",
        "status": "running",
        "progress_pct": 55,
    })

    try:
        chunks = list(
            Chunk.objects.filter(document=document).order_by("index")
        )

        if not chunks:
            logger.warning("No chunks found for document %s", document_id)
            _add_stage(document_id, "embedding", "completed", "No chunks to embed")
            _finalize_completed(document_id)
            return document_id

        # Embed in batches
        batch_size = 64
        texts = [c.text for c in chunks]
        all_embeddings: list[list[float]] = []

        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i : i + batch_size]
            batch_embeddings = EmbeddingService.embed(batch_texts)
            all_embeddings.extend(batch_embeddings)

            # Update progress proportionally
            progress = 55 + int(30 * min((i + batch_size), len(texts)) / len(texts))
            _update_job(document_id, progress_pct=progress)
            _send_ws_event(document_id, {
                "stage": "embedding",
                "status": "running",
                "progress_pct": progress,
            })

        # Store chunk nodes in Neo4j
        doc_id_str = str(document.id)
        prev_chunk_id = None

        for chunk, embedding in zip(chunks, all_embeddings):
            chunk_id_str = str(chunk.id)
            chunk_data = {
                "id": chunk_id_str,
                "document_id": doc_id_str,
                "text": chunk.text,
                "index": chunk.index,
                "embedding": embedding,
                "page_number": chunk.metadata.get("page_number"),
                "section": chunk.metadata.get("section"),
            }
            Neo4jClient.store_chunk_sync(chunk_data)

            # Update the chunk's neo4j_node_id
            chunk.neo4j_node_id = chunk_id_str
            chunk.save(update_fields=["neo4j_node_id", "updated_at"])

            # Create NEXT_CHUNK relationship between consecutive chunks
            if prev_chunk_id is not None:
                Neo4jClient.create_relationship_sync(
                    from_id=prev_chunk_id,
                    to_id=chunk_id_str,
                    rel_type="NEXT_CHUNK",
                )
            prev_chunk_id = chunk_id_str

        _add_stage(document_id, "embedding", "completed")
        _send_ws_event(document_id, {
            "stage": "embedding",
            "status": "completed",
            "progress_pct": 55,
        })

        logger.info(
            "Embedded %d chunks for document %s", len(chunks), document_id
        )

    except Exception as exc:
        _mark_failed(document_id, "embedding", str(exc))
        raise

    return document_id


# ---------------------------------------------------------------------------
# Pipeline orchestrator
# ---------------------------------------------------------------------------


def run_ingestion_pipeline(document_id: str) -> str:
    """
    Launch the full ingestion pipeline as a Celery chain.

    Returns the Celery task ID of the chain.
    """
    from apps.documents.models import IngestionJob
    from apps.knowledge_graph.tasks import (
        build_knowledge_graph_task,
        extract_entities_task,
    )

    pipeline = chain(
        parse_document_task.si(document_id),
        chunk_document_task.si(document_id),
        embed_chunks_task.si(document_id),
        extract_entities_task.si(document_id),
        build_knowledge_graph_task.s(document_id=document_id),
    )
    result = pipeline.apply_async()

    # Store the task ID on the IngestionJob
    IngestionJob.objects.filter(document__id=document_id).update(
        celery_task_id=result.id,
    )

    return result.id


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _mark_failed(document_id: str, stage: str, error_msg: str) -> None:
    """Mark a document and its ingestion job as failed."""
    from apps.documents.models import Document

    logger.error(
        "Document %s failed at stage '%s': %s", document_id, stage, error_msg
    )

    Document.objects.filter(id=document_id).update(
        status=Document.Status.FAILED,
        error_message=error_msg,
    )
    _add_stage(document_id, stage, "failed", error_msg)
    _update_job(
        document_id,
        status="failed",
        error_message=error_msg,
        completed_at=datetime.now(timezone.utc),
    )
    _send_ws_event(document_id, {
        "stage": stage,
        "status": "failed",
        "error": error_msg,
    })


def _finalize_completed(document_id: str) -> None:
    """Mark a document and its ingestion job as completed."""
    from apps.documents.models import Document

    Document.objects.filter(id=document_id).update(
        status=Document.Status.COMPLETED,
    )
    _update_job(
        document_id,
        status="completed",
        progress_pct=100,
        current_stage="completed",
        completed_at=datetime.now(timezone.utc),
    )
    _send_ws_event(document_id, {
        "stage": "completed",
        "status": "completed",
        "progress_pct": 100,
    })
    logger.info("Document %s ingestion completed", document_id)
