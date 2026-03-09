import json

from channels.generic.websocket import AsyncJsonWebsocketConsumer as AsyncJsonWebSocketConsumer


class IngestionConsumer(AsyncJsonWebSocketConsumer):
    """WebSocket consumer for real-time ingestion progress updates."""

    async def connect(self):
        self.document_id = self.scope["url_route"]["kwargs"]["document_id"]
        self.group_name = f"ingestion_{self.document_id}"

        # Check authentication
        user = self.scope.get("user")
        if not user or user.is_anonymous:
            await self.close(code=4001)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def ingestion_stage_update(self, event):
        """Handle ingestion.stage_update event from Celery tasks."""
        await self.send_json(
            {
                "type": "stage_update",
                "stage": event["stage"],
                "status": event["status"],
                "progress_pct": event["progress_pct"],
                "message": event.get("message", ""),
            }
        )

    async def ingestion_completed(self, event):
        """Handle ingestion.completed event."""
        await self.send_json(
            {
                "type": "completed",
                "stats": event.get("stats", {}),
            }
        )

    async def ingestion_error(self, event):
        """Handle ingestion.error event."""
        await self.send_json(
            {
                "type": "error",
                "message": event.get("message", "Unknown error"),
                "retryable": event.get("retryable", False),
            }
        )


class QueryStreamConsumer(AsyncJsonWebSocketConsumer):
    """WebSocket consumer for streaming query responses."""

    async def connect(self):
        user = self.scope.get("user")
        if not user or user.is_anonymous:
            await self.close(code=4001)
            return

        self.user_id = str(user.id)
        self.group_name = f"query_{self.user_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        """Handle incoming query requests via WebSocket."""
        # This will be implemented in Phase 4 to dispatch queries
        await self.send_json(
            {
                "type": "info",
                "message": "Query processing will be available soon.",
            }
        )

    async def query_chunk(self, event):
        """Stream a chunk of the query response."""
        await self.send_json(
            {
                "type": "chunk",
                "content": event["content"],
            }
        )

    async def query_sources(self, event):
        """Send source citations."""
        await self.send_json(
            {
                "type": "sources",
                "sources": event["sources"],
            }
        )

    async def query_complete(self, event):
        """Signal query completion."""
        await self.send_json(
            {
                "type": "complete",
                "metadata": event.get("metadata", {}),
            }
        )

    async def query_error(self, event):
        """Send error to client."""
        await self.send_json(
            {
                "type": "error",
                "message": event.get("message", "Query failed"),
            }
        )
