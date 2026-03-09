"""Graph RAG pipeline — graph-tool retrieval + LLM generation."""

import logging
import time
from typing import AsyncIterator

from .base import BasePipeline, PipelineResult

logger = logging.getLogger(__name__)

GRAPH_RAG_TEMPLATE = """\
You are a helpful assistant with access to a knowledge graph and supporting document chunks.
Answer the question by reasoning over the graph structure first:
1. Identify the key entities involved.
2. Explain the direct or multi-hop relationships that connect them.
3. Use the supporting chunks to ground important claims.
If the graph does not establish a connection, say so clearly.

Context:
{context}

Question: {query}

Answer:"""


class GraphRAGPipeline(BasePipeline):
    """
    GraphRAG pipeline:
    1. Use the selected graph tool to retrieve context
    2. Build enriched context (includes entity relationships)
    3. Send to LLM with context + query
    4. Return answer + sources + tool metadata
    """

    async def execute(self, query: str, **kwargs) -> PipelineResult:
        start = time.perf_counter()

        provider_name: str = kwargs.get("provider", "")
        model: str = kwargs.get("model", "")
        graph_tool_name: str = kwargs.get("graph_tool", "neo4j_graphrag")
        top_k: int = kwargs.get("top_k", 5)
        document_ids: list[str] | None = kwargs.get("document_ids")
        temperature: float = kwargs.get("temperature", 0.7)

        # ---- 1. Resolve LLM provider ----
        from apps.retrieval.llm.factory import get_default_provider, get_provider

        if provider_name:
            provider = get_provider(provider_name)
        else:
            provider = get_default_provider()
            if provider is None:
                return PipelineResult(
                    answer="No LLM provider is configured. Please set an API key.",
                    sources=[],
                    latency_ms=(time.perf_counter() - start) * 1000,
                )

        # ---- 2. Retrieve context using graph tool ----
        from apps.retrieval.tools.factory import get_tool

        try:
            tool = get_tool(graph_tool_name)
        except ValueError as exc:
            return PipelineResult(
                answer=f"Graph tool error: {exc}",
                sources=[],
                latency_ms=(time.perf_counter() - start) * 1000,
            )

        tool_result = await tool.retrieve(
            query=query,
            top_k=top_k,
            document_ids=document_ids,
        )

        # ---- 3. Build enriched context ----
        sources: list[dict] = []
        context_parts: list[str] = []

        for ctx in tool_result.contexts:
            context_parts.append(ctx.text)
            sources.append(
                {
                    "text": ctx.text[:500],
                    "score": ctx.score,
                    "source": ctx.source,
                    "metadata": ctx.metadata,
                }
            )

        context_text = "\n\n---\n\n".join(context_parts) if context_parts else "(no context found)"

        # ---- 4. Send to LLM ----
        prompt = GRAPH_RAG_TEMPLATE.format(context=context_text, query=query)
        messages = [{"role": "user", "content": prompt}]

        try:
            llm_response = await provider.generate(
                messages=messages,
                model=model or None,
                temperature=temperature,
            )
            answer = llm_response.content
            token_count = llm_response.usage
        except Exception as exc:
            logger.error("Graph RAG LLM call failed: %s", exc)
            answer = f"Error generating answer: {exc}"
            token_count = {}

        latency_ms = (time.perf_counter() - start) * 1000

        return PipelineResult(
            answer=answer,
            sources=sources,
            latency_ms=latency_ms,
            tool_metadata=tool_result.metadata,
            token_count=token_count,
        )

    async def stream(self, query: str, **kwargs) -> AsyncIterator[str | dict]:
        """Stream tokens from the LLM for a graph RAG query."""

        provider_name: str = kwargs.get("provider", "")
        model: str = kwargs.get("model", "")
        graph_tool_name: str = kwargs.get("graph_tool", "neo4j_graphrag")
        top_k: int = kwargs.get("top_k", 5)
        document_ids: list[str] | None = kwargs.get("document_ids")
        temperature: float = kwargs.get("temperature", 0.7)

        start = time.perf_counter()

        # ---- Resolve LLM provider ----
        from apps.retrieval.llm.factory import get_default_provider, get_provider

        if provider_name:
            provider = get_provider(provider_name)
        else:
            provider = get_default_provider()
            if provider is None:
                yield {"type": "error", "message": "No LLM provider is configured."}
                return

        # ---- Retrieve context using graph tool ----
        from apps.retrieval.tools.factory import get_tool

        try:
            tool = get_tool(graph_tool_name)
        except ValueError as exc:
            yield {"type": "error", "message": f"Graph tool error: {exc}"}
            return

        tool_result = await tool.retrieve(
            query=query,
            top_k=top_k,
            document_ids=document_ids,
        )

        sources: list[dict] = []
        context_parts: list[str] = []

        for ctx in tool_result.contexts:
            context_parts.append(ctx.text)
            sources.append(
                {
                    "text": ctx.text[:500],
                    "score": ctx.score,
                    "source": ctx.source,
                    "metadata": ctx.metadata,
                }
            )

        # Emit sources and tool metadata early
        yield {"type": "sources", "sources": sources}
        if tool_result.metadata:
            yield {"type": "tool_metadata", "tool_metadata": tool_result.metadata}

        context_text = "\n\n---\n\n".join(context_parts) if context_parts else "(no context found)"
        prompt = GRAPH_RAG_TEMPLATE.format(context=context_text, query=query)
        messages = [{"role": "user", "content": prompt}]

        # ---- Stream LLM response ----
        try:
            async for chunk in provider.stream(
                messages=messages,
                model=model or None,
                temperature=temperature,
            ):
                yield chunk  # str token
        except Exception as exc:
            logger.error("Graph RAG streaming failed: %s", exc)
            yield {"type": "error", "message": str(exc)}
            return

        latency_ms = (time.perf_counter() - start) * 1000
        yield {"type": "metadata", "latency_ms": latency_ms, "pipeline": "graph"}
