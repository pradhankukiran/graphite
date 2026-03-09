"""
Helper functions to send WebSocket events from synchronous contexts (e.g. Celery tasks).

These use async_to_sync to bridge from sync Celery workers to the async
channel layer, sending group messages that are picked up by the consumers.
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


# ---------------------------------------------------------------------------
# Ingestion events
# ---------------------------------------------------------------------------


def send_ingestion_update(
    document_id: str,
    stage: str,
    status: str,
    progress_pct: int,
    message: str = "",
):
    """Send ingestion progress update to WebSocket group."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"ingestion_{document_id}",
        {
            "type": "ingestion.stage_update",
            "stage": stage,
            "status": status,
            "progress_pct": progress_pct,
            "message": message,
        },
    )


def send_ingestion_completed(document_id: str, stats: dict):
    """Send ingestion completed event."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"ingestion_{document_id}",
        {
            "type": "ingestion.completed",
            "stats": stats,
        },
    )


def send_ingestion_error(document_id: str, message: str, retryable: bool = False):
    """Send ingestion error event."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"ingestion_{document_id}",
        {
            "type": "ingestion.error",
            "message": message,
            "retryable": retryable,
        },
    )


# ---------------------------------------------------------------------------
# Query events
# ---------------------------------------------------------------------------


def send_query_chunk(user_id: str, content: str):
    """Send a streamed query response chunk."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"query_{user_id}",
        {
            "type": "query.chunk",
            "content": content,
        },
    )


def send_query_sources(user_id: str, sources: list):
    """Send source citations for a query."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"query_{user_id}",
        {
            "type": "query.sources",
            "sources": sources,
        },
    )


def send_query_complete(user_id: str, metadata: dict):
    """Send query completion event."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"query_{user_id}",
        {
            "type": "query.complete",
            "metadata": metadata,
        },
    )


def send_query_error(user_id: str, message: str):
    """Send query error event."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"query_{user_id}",
        {
            "type": "query.error",
            "message": message,
        },
    )
