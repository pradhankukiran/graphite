"""Django Ninja schemas for the Documents app."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from ninja import FilterSchema, Schema


# ---------------------------------------------------------------------------
# Output schemas
# ---------------------------------------------------------------------------


class DocumentOut(Schema):
    """Full document representation."""

    id: UUID
    filename: str
    file_type: str
    file_size: int
    file_size_display: str
    status: str
    raw_text: str
    metadata: dict
    chunk_count: int
    entity_count: int
    error_message: str
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_file_size_display(obj) -> str:
        size = obj.file_size
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        elif size < 1024 * 1024 * 1024:
            return f"{size / (1024 * 1024):.1f} MB"
        else:
            return f"{size / (1024 * 1024 * 1024):.1f} GB"


class DocumentListOut(Schema):
    """Lightweight document representation for list views."""

    id: UUID
    filename: str
    file_type: str
    file_size: int
    file_size_display: str
    status: str
    chunk_count: int
    entity_count: int
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_file_size_display(obj) -> str:
        size = obj.file_size
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        elif size < 1024 * 1024 * 1024:
            return f"{size / (1024 * 1024):.1f} MB"
        else:
            return f"{size / (1024 * 1024 * 1024):.1f} GB"


class ChunkOut(Schema):
    """Chunk representation."""

    id: UUID
    index: int
    text: str
    char_start: int
    char_end: int
    metadata: dict
    neo4j_node_id: str
    created_at: datetime


class IngestionJobOut(Schema):
    """Ingestion job status representation."""

    id: UUID
    document_id: UUID
    celery_task_id: Optional[str] = None
    status: str
    progress_pct: int
    current_stage: str
    stages: list
    error_message: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class DocumentUploadOut(Schema):
    """Returned after a successful document upload."""

    document_id: UUID
    filename: str
    status: str
    message: str


class DocumentStatsOut(Schema):
    """Aggregate document statistics for the current user."""

    total_documents: int
    total_chunks: int
    total_entities: int
    status_breakdown: dict


# ---------------------------------------------------------------------------
# Filter / input schemas
# ---------------------------------------------------------------------------


class DocumentFilterParams(FilterSchema):
    """Query parameters for filtering documents."""

    status: Optional[str] = None
    file_type: Optional[str] = None
    search: Optional[str] = None
