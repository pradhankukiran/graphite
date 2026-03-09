"""Query orchestration service — ties pipelines, persistence, and streaming together."""

from __future__ import annotations

import json
import logging
import time
from typing import AsyncIterator

from asgiref.sync import sync_to_async

from apps.retrieval.models import QueryResult
from apps.retrieval.pipelines.graph_rag import GraphRAGPipeline
from apps.retrieval.pipelines.plain_rag import PlainRAGPipeline

logger = logging.getLogger(__name__)
DEFAULT_GRAPH_TOOL = "neo4j_graphrag"


def _resolve_provider_info(
    provider_name: str,
    model_name: str = "",
) -> tuple[str, str, str]:
    """Return (provider_name, display_name, resolved_model) for the provider.

    If *provider_name* is empty, the first configured provider is used.
    """
    from apps.retrieval.llm.factory import get_default_provider, get_provider

    if provider_name:
        p = get_provider(provider_name)
        normalized_provider = provider_name.lower()
    else:
        p = get_default_provider()
        if p is None:
            return "", "", ""
        normalized_provider = p.provider_name.lower()

    available_models = p.get_available_models()
    resolved_model = model_name or (
        available_models[0]["id"] if available_models else ""
    )
    return normalized_provider, p.provider_name, resolved_model


async def execute_query(
    user,
    query: str,
    mode: str = "graph",
    provider: str = "",
    model: str = "",
    graph_tool: str = "neo4j_graphrag",
    top_k: int = 5,
    document_ids: list[str] | None = None,
    temperature: float = 0.7,
) -> QueryResult:
    """Execute a query through the appropriate pipeline and persist the result."""
    start = time.perf_counter()

    if mode not in ("plain", "graph"):
        raise ValueError("Unsupported query mode. Use 'plain' or 'graph'.")
    if mode == "graph":
        graph_tool = DEFAULT_GRAPH_TOOL

    # Resolve which provider we will actually use
    resolved_provider, display_name, resolved_model = _resolve_provider_info(
        provider,
        model,
    )

    pipeline_kwargs = {
        "provider": resolved_provider or provider,
        "model": resolved_model,
        "graph_tool": graph_tool,
        "top_k": top_k,
        "document_ids": document_ids,
        "temperature": temperature,
    }

    # Select pipeline
    if mode == "plain":
        pipeline = PlainRAGPipeline()
    else:
        pipeline = GraphRAGPipeline()
        mode = "graph"

    result = await pipeline.execute(query, **pipeline_kwargs)

    total_latency_ms = (time.perf_counter() - start) * 1000

    # Build results JSON
    results_json: dict = {}

    if mode == "plain":
        results_json["plain"] = {
            "answer": result.answer,
            "sources": result.sources,
            "latency_ms": result.latency_ms,
            "token_count": result.token_count,
        }
    else:
        results_json["graph"] = {
            "answer": result.answer,
            "sources": result.sources,
            "latency_ms": result.latency_ms,
            "tool_metadata": result.tool_metadata,
            "token_count": result.token_count,
        }

    # Persist to database
    query_result = await sync_to_async(QueryResult.objects.create)(
        user=user,
        query_text=query,
        mode=mode,
        llm_provider=resolved_provider,
        llm_model=resolved_model,
        graph_tool=graph_tool if mode == "graph" else "",
        results=results_json,
        total_latency_ms=total_latency_ms,
        token_count=result.token_count,
    )

    return query_result


async def stream_query(
    user,
    query: str,
    mode: str = "graph",
    provider: str = "",
    model: str = "",
    graph_tool: str = "neo4j_graphrag",
    top_k: int = 5,
    document_ids: list[str] | None = None,
    temperature: float = 0.7,
) -> AsyncIterator[str]:
    """Stream a query response using SSE-compatible JSON payloads.

    Each yielded string is a JSON object suitable for wrapping in ``data: ...\\n\\n``.
    """
    if mode not in ("plain", "graph"):
        raise ValueError("Unsupported query mode. Use 'plain' or 'graph'.")
    if mode == "graph":
        graph_tool = DEFAULT_GRAPH_TOOL

    resolved_provider, _, resolved_model = _resolve_provider_info(provider, model)

    pipeline_kwargs = {
        "provider": resolved_provider or provider,
        "model": resolved_model,
        "graph_tool": graph_tool,
        "top_k": top_k,
        "document_ids": document_ids,
        "temperature": temperature,
    }

    # Select pipeline
    if mode == "plain":
        pipeline = PlainRAGPipeline()
    else:
        pipeline = GraphRAGPipeline()
        mode = "graph"

    answer_parts: list[str] = []
    sources: list[dict] = []
    tool_metadata: dict = {}
    latency_ms = 0.0
    error_message = ""

    try:
        async for chunk in pipeline.stream(query, **pipeline_kwargs):
            if isinstance(chunk, dict):
                chunk_type = chunk.get("type")
                if chunk_type == "sources":
                    sources = chunk.get("sources", [])
                elif chunk_type == "tool_metadata":
                    tool_metadata = chunk.get("tool_metadata", {}) or {}
                elif chunk_type == "metadata":
                    latency_ms = float(chunk.get("latency_ms", 0.0) or 0.0)
                elif chunk_type == "error":
                    error_message = str(chunk.get("message", ""))
                # Structured event (sources, metadata, error, etc.)
                yield json.dumps(chunk)
            else:
                # String token
                answer_parts.append(chunk)
                yield json.dumps({"content": chunk})
    except Exception as exc:
        logger.error("Stream query error (%s mode): %s", mode, exc)
        error_message = str(exc)
        yield json.dumps({"type": "error", "message": str(exc)})
        return

    if error_message:
        return

    total_latency_ms = latency_ms or 0.0
    results_json: dict = {}

    if mode == "plain":
        results_json["plain"] = {
            "answer": "".join(answer_parts),
            "sources": sources,
            "latency_ms": total_latency_ms,
            "token_count": {},
        }
    else:
        results_json["graph"] = {
            "answer": "".join(answer_parts),
            "sources": sources,
            "latency_ms": total_latency_ms,
            "tool_metadata": tool_metadata,
            "token_count": {},
        }

    await sync_to_async(QueryResult.objects.create)(
        user=user,
        query_text=query,
        mode=mode,
        llm_provider=resolved_provider,
        llm_model=resolved_model,
        graph_tool=graph_tool if mode == "graph" else "",
        results=results_json,
        total_latency_ms=total_latency_ms,
        token_count={},
    )
