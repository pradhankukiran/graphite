"""Celery tasks for entity extraction and knowledge graph building."""

import logging
import uuid

from celery import shared_task
from django.utils import timezone

from apps.websockets.events import (
    send_ingestion_completed,
    send_ingestion_error,
    send_ingestion_update,
)

logger = logging.getLogger(__name__)


@shared_task(queue="llm", bind=True, max_retries=2)
def extract_entities_task(self, document_id: str):
    """Extract entities from document chunks using LLM."""
    from apps.documents.models import Document, Chunk, IngestionJob
    from apps.knowledge_graph.extractors import EntityExtractor
    from apps.knowledge_graph.models import GraphBuildJob

    document = Document.objects.get(id=document_id)
    document.status = Document.Status.EXTRACTING
    document.save(update_fields=["status"])

    job, _ = GraphBuildJob.objects.get_or_create(
        document=document,
        defaults={"status": GraphBuildJob.Status.EXTRACTING, "started_at": timezone.now()},
    )
    job.status = GraphBuildJob.Status.EXTRACTING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at"])

    # Update ingestion job
    try:
        ingestion_job = document.ingestion_job
        ingestion_job.current_stage = "extracting"
        ingestion_job.progress_pct = 60
        ingestion_job.save(update_fields=["current_stage", "progress_pct"])
    except IngestionJob.DoesNotExist:
        pass

    send_ingestion_update(document_id, "extracting", "running", 60, "Extracting entities...")

    try:
        extractor = EntityExtractor()
        chunks = list(Chunk.objects.filter(document=document).order_by("index"))

        all_entities = {}  # name -> entity dict (deduplicated)
        all_relationships = []

        for i, chunk in enumerate(chunks):
            result = extractor.extract(chunk.text)

            for entity in result.get("entities", []):
                name = entity["name"]
                if name in all_entities:
                    # Merge: keep richer description
                    if len(entity.get("description", "")) > len(
                        all_entities[name].get("description", "")
                    ):
                        all_entities[name]["description"] = entity["description"]
                else:
                    entity["id"] = str(uuid.uuid4())
                    entity["source_chunk_ids"] = []
                    all_entities[name] = entity
                all_entities[name]["source_chunk_ids"].append(str(chunk.id))

            for rel in result.get("relationships", []):
                rel["source_chunk_id"] = str(chunk.id)
                all_relationships.append(rel)

            # Progress update every 5 chunks
            if (i + 1) % 5 == 0 or i == len(chunks) - 1:
                pct = 60 + int(20 * (i + 1) / len(chunks))
                send_ingestion_update(
                    document_id,
                    "extracting",
                    "running",
                    pct,
                    f"Extracted entities from {i + 1}/{len(chunks)} chunks",
                )

        job.entities_extracted = len(all_entities)
        job.relations_extracted = len(all_relationships)
        job.save(update_fields=["entities_extracted", "relations_extracted"])

        # Return extraction results for the next task in the chain
        return {
            "document_id": document_id,
            "entities": list(all_entities.values()),
            "relationships": all_relationships,
        }

    except Exception as e:
        logger.error(f"Entity extraction failed for document {document_id}: {e}")
        job.status = GraphBuildJob.Status.FAILED
        job.error_message = str(e)
        job.save(update_fields=["status", "error_message"])
        document.status = Document.Status.FAILED
        document.error_message = f"Entity extraction failed: {e}"
        document.save(update_fields=["status", "error_message"])
        send_ingestion_error(document_id, str(e), retryable=True)
        raise


@shared_task(queue="graph", bind=True, max_retries=2)
def build_knowledge_graph_task(self, extraction_result: dict, document_id: str = None):
    """Build knowledge graph in Neo4j from extracted entities."""
    from apps.documents.models import Document, IngestionJob
    from apps.knowledge_graph.models import GraphBuildJob
    from apps.knowledge_graph.neo4j_client import Neo4jClient

    # Handle both chain (extraction_result as first arg) and direct call
    if document_id is None:
        document_id = extraction_result.get("document_id")

    entities = extraction_result.get("entities", [])
    relationships = extraction_result.get("relationships", [])

    document = Document.objects.get(id=document_id)
    document.status = Document.Status.BUILDING_GRAPH
    document.save(update_fields=["status"])

    job = GraphBuildJob.objects.get(document=document)
    job.status = GraphBuildJob.Status.BUILDING
    job.save(update_fields=["status"])

    send_ingestion_update(
        document_id, "building_graph", "running", 80, "Building knowledge graph..."
    )

    try:
        # Store entities in Neo4j
        entities_created = 0
        entity_name_to_id = {}

        for entity in entities:
            entity_data = {
                "id": entity["id"],
                "name": entity["name"],
                "type": entity["type"],
                "description": entity.get("description", ""),
                "source_document_ids": [document_id],
                "properties": {},
            }
            Neo4jClient.store_entity_sync(entity_data)
            entity_name_to_id[entity["name"]] = entity["id"]
            entities_created += 1

            # Create MENTIONS relationships from chunks to entity
            for chunk_id in entity.get("source_chunk_ids", []):
                Neo4jClient.create_relationship_sync(
                    chunk_id, entity["id"], "MENTIONS", {"confidence": 0.9}
                )

        # Store relationships in Neo4j
        relations_created = 0
        for rel in relationships:
            source_id = entity_name_to_id.get(rel["source"])
            target_id = entity_name_to_id.get(rel["target"])
            if source_id and target_id:
                Neo4jClient.create_relationship_sync(
                    source_id,
                    target_id,
                    "RELATES_TO",
                    {
                        "type": rel["type"],
                        "description": rel.get("description", ""),
                        "weight": 1.0,
                    },
                )
                relations_created += 1

        # Update job and document
        job.entities_created = entities_created
        job.relations_created = relations_created
        job.status = GraphBuildJob.Status.COMPLETED
        job.completed_at = timezone.now()
        job.save(
            update_fields=["entities_created", "relations_created", "status", "completed_at"]
        )

        document.entity_count = entities_created
        document.status = Document.Status.COMPLETED
        document.save(update_fields=["entity_count", "status"])

        # Update ingestion job
        try:
            ingestion_job = document.ingestion_job
            ingestion_job.status = IngestionJob.Status.COMPLETED
            ingestion_job.current_stage = "completed"
            ingestion_job.progress_pct = 100
            ingestion_job.completed_at = timezone.now()
            ingestion_job.save(
                update_fields=["status", "current_stage", "progress_pct", "completed_at"]
            )
        except IngestionJob.DoesNotExist:
            pass

        send_ingestion_update(
            document_id, "building_graph", "completed", 100, "Knowledge graph built"
        )
        send_ingestion_completed(
            document_id,
            {
                "entities_created": entities_created,
                "relations_created": relations_created,
                "chunks": document.chunk_count,
            },
        )

        return {
            "document_id": document_id,
            "entities_created": entities_created,
            "relations_created": relations_created,
        }

    except Exception as e:
        logger.error(f"Graph build failed for document {document_id}: {e}")
        job.status = GraphBuildJob.Status.FAILED
        job.error_message = str(e)
        job.save(update_fields=["status", "error_message"])
        document.status = Document.Status.FAILED
        document.error_message = f"Graph build failed: {e}"
        document.save(update_fields=["status", "error_message"])
        send_ingestion_error(document_id, str(e), retryable=True)
        raise
