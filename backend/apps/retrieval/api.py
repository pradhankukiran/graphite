"""Django Ninja API endpoints for the retrieval / query app."""

import json
import logging
from uuid import UUID

from django.http import HttpRequest, StreamingHttpResponse
from ninja import Query, Router
from ninja.pagination import paginate
from ninja_jwt.authentication import JWTAuth

from apps.core.pagination import PageNumberPagination
from apps.retrieval.models import QueryResult
from apps.retrieval.schemas import (
    GraphToolOut,
    LLMProviderOut,
    QueryHistoryOut,
    QueryIn,
    QueryResultOut,
)
from apps.retrieval.services import execute_query, stream_query

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Query router
# ---------------------------------------------------------------------------

query_router = Router(tags=["Query"], auth=JWTAuth())


def _build_query_result_out(qr: QueryResult) -> dict:
    """Convert a QueryResult model instance into a QueryResultOut-compatible dict."""
    plain_data = qr.results.get("plain")
    graph_data = qr.results.get("graph")

    plain_result = None
    if plain_data:
        plain_result = {
            "answer": plain_data.get("answer", ""),
            "sources": plain_data.get("sources", []),
            "latency_ms": plain_data.get("latency_ms", 0.0),
            "tool_metadata": plain_data.get("tool_metadata", {}),
            "token_count": plain_data.get("token_count", {}),
        }

    graph_result = None
    if graph_data:
        graph_result = {
            "answer": graph_data.get("answer", ""),
            "sources": graph_data.get("sources", []),
            "latency_ms": graph_data.get("latency_ms", 0.0),
            "tool_metadata": graph_data.get("tool_metadata", {}),
            "token_count": graph_data.get("token_count", {}),
        }

    return {
        "id": str(qr.id),
        "query": qr.query_text,
        "mode": qr.mode,
        "provider": qr.llm_provider,
        "model": qr.llm_model,
        "graph_tool": qr.graph_tool,
        "plain_result": plain_result,
        "graph_result": graph_result,
        "total_latency_ms": qr.total_latency_ms,
        "created_at": qr.created_at.isoformat(),
    }


@query_router.post("/", response={200: QueryResultOut, 400: dict, 500: dict})
async def execute_query_endpoint(request: HttpRequest, payload: QueryIn):
    """Execute a RAG query (non-streaming) and return the full result."""
    try:
        qr = await execute_query(
            user=request.auth,
            query=payload.query,
            mode=payload.mode,
            provider=payload.provider,
            model=payload.model,
            graph_tool=payload.graph_tool,
            top_k=payload.top_k,
            document_ids=payload.document_ids,
            temperature=payload.temperature,
        )
        return 200, _build_query_result_out(qr)
    except ValueError as exc:
        logger.warning("Query validation error: %s", exc)
        return 400, {"detail": str(exc)}
    except Exception as exc:
        logger.error("Query execution error: %s", exc, exc_info=True)
        return 500, {"detail": f"Internal error: {exc}"}


@query_router.post("/stream", auth=JWTAuth())
async def stream_query_endpoint(request: HttpRequest, payload: QueryIn):
    """Stream a RAG query response using Server-Sent Events."""

    async def event_stream():
        try:
            async for chunk in stream_query(
                user=request.auth,
                query=payload.query,
                mode=payload.mode,
                provider=payload.provider,
                model=payload.model,
                graph_tool=payload.graph_tool,
                top_k=payload.top_k,
                document_ids=payload.document_ids,
                temperature=payload.temperature,
            ):
                # chunk is already a JSON string from services.stream_query
                yield f"data: {chunk}\n\n"
        except Exception as exc:
            logger.error("SSE stream error: %s", exc, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingHttpResponse(
        event_stream(),
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@query_router.get("/history", response=list[QueryHistoryOut])
@paginate(PageNumberPagination)
def list_query_history(request: HttpRequest):
    """List query history for the current user (paginated, newest first)."""
    return QueryResult.objects.filter(user=request.auth).exclude(
        mode=QueryResult.Mode.COMPARE
    ).values(
        "id",
        "query_text",
        "mode",
        "llm_provider",
        "llm_model",
        "total_latency_ms",
        "created_at",
    )


@query_router.get(
    "/history/{query_id}",
    response={200: QueryResultOut, 404: dict},
)
async def get_query_result(request: HttpRequest, query_id: UUID):
    """Get a single query result by ID."""
    from asgiref.sync import sync_to_async

    try:
        qr = await sync_to_async(QueryResult.objects.get)(
            id=query_id,
            user=request.auth,
        )
    except QueryResult.DoesNotExist:
        return 404, {"detail": "Query result not found"}

    return 200, _build_query_result_out(qr)


# ---------------------------------------------------------------------------
# Settings router
# ---------------------------------------------------------------------------

settings_router = Router(tags=["Settings"], auth=JWTAuth())


@settings_router.get("/llm-providers", response=list[LLMProviderOut])
def list_llm_providers(request: HttpRequest):
    """Return all available LLM providers and their configuration status."""
    from apps.retrieval.llm.factory import get_available_providers

    providers = get_available_providers()
    return [
        {
            "name": p["name"],
            "display_name": p["display_name"],
            "configured": p["configured"],
            "models": p["models"],
        }
        for p in providers
    ]


@settings_router.get("/graph-tools", response=list[GraphToolOut])
def list_graph_tools(request: HttpRequest):
    """Return all available graph retrieval tools."""
    from apps.retrieval.tools.factory import get_available_tools

    return get_available_tools()
