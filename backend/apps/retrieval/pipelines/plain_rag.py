"""Plain RAG pipeline — vector search + LLM generation without graph enrichment."""

import logging
import time
from typing import AsyncIterator

from .base import BasePipeline, PipelineResult

logger = logging.getLogger(__name__)

PLAIN_RAG_SYSTEM_PROMPT = (
    "You are a helpful assistant. Answer the question based on the provided context.\n"
    "If the context doesn't contain enough information, say so."
)

PLAIN_RAG_TEMPLATE = """\
You are a helpful assistant. Answer the question based on the provided context.
If the context doesn't contain enough information, say so.

Context:
{context}

Question: {query}

Answer:"""


class PlainRAGPipeline(BasePipeline):
    """
    Plain RAG pipeline:
    1. Embed query using EmbeddingService
    2. Vector search in Neo4j for top_k chunks
    3. Build context from chunks
    4. Send to LLM with context + query
    5. Return answer + sources
    """

    async def execute(self, query: str, **kwargs) -> PipelineResult:
        start = time.perf_counter()

        provider_name: str = kwargs.get("provider", "")
        model: str = kwargs.get("model", "")
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

        # ---- 2. Embed the query ----
        from apps.retrieval.embeddings import EmbeddingService

        query_embedding = EmbeddingService.embed_single(query)

        # ---- 3. Vector search ----
        from apps.knowledge_graph.neo4j_client import Neo4jClient

        raw_results = await Neo4jClient.vector_search(
            embedding=query_embedding,
            top_k=top_k,
            document_ids=document_ids,
        )

        # ---- 4. Build context and source list ----
        sources: list[dict] = []
        context_parts: list[str] = []

        for row in raw_results:
            chunk = row.get("chunk", {})
            score = row.get("score", 0.0)
            text = chunk.get("text", "")
            context_parts.append(text)
            sources.append(
                {
                    "text": text[:500],
                    "score": score,
                    "source": f"Chunk {chunk.get('index', '?')} (Doc: {chunk.get('document_id', '?')})",
                    "metadata": {
                        "chunk_id": chunk.get("id", ""),
                        "document_id": chunk.get("document_id", ""),
                        "index": chunk.get("index"),
                        "page_number": chunk.get("page_number"),
                        "section": chunk.get("section"),
                    },
                }
            )

        context_text = "\n\n---\n\n".join(context_parts) if context_parts else "(no context found)"

        # ---- 5. Send to LLM ----
        prompt = PLAIN_RAG_TEMPLATE.format(context=context_text, query=query)
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
            logger.error("Plain RAG LLM call failed: %s", exc)
            answer = f"Error generating answer: {exc}"
            token_count = {}

        latency_ms = (time.perf_counter() - start) * 1000

        return PipelineResult(
            answer=answer,
            sources=sources,
            latency_ms=latency_ms,
            token_count=token_count,
        )

    async def stream(self, query: str, **kwargs) -> AsyncIterator[str | dict]:
        """Stream tokens from the LLM for a plain RAG query."""
        import json

        provider_name: str = kwargs.get("provider", "")
        model: str = kwargs.get("model", "")
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

        # ---- Embed + search ----
        from apps.retrieval.embeddings import EmbeddingService
        from apps.knowledge_graph.neo4j_client import Neo4jClient

        query_embedding = EmbeddingService.embed_single(query)
        raw_results = await Neo4jClient.vector_search(
            embedding=query_embedding,
            top_k=top_k,
            document_ids=document_ids,
        )

        sources: list[dict] = []
        context_parts: list[str] = []

        for row in raw_results:
            chunk = row.get("chunk", {})
            score = row.get("score", 0.0)
            text = chunk.get("text", "")
            context_parts.append(text)
            sources.append(
                {
                    "text": text[:500],
                    "score": score,
                    "source": f"Chunk {chunk.get('index', '?')} (Doc: {chunk.get('document_id', '?')})",
                    "metadata": {
                        "chunk_id": chunk.get("id", ""),
                        "document_id": chunk.get("document_id", ""),
                        "index": chunk.get("index"),
                        "page_number": chunk.get("page_number"),
                        "section": chunk.get("section"),
                    },
                }
            )

        # Emit sources early so the frontend can render them
        yield {"type": "sources", "sources": sources}

        context_text = "\n\n---\n\n".join(context_parts) if context_parts else "(no context found)"
        prompt = PLAIN_RAG_TEMPLATE.format(context=context_text, query=query)
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
            logger.error("Plain RAG streaming failed: %s", exc)
            yield {"type": "error", "message": str(exc)}
            return

        latency_ms = (time.perf_counter() - start) * 1000
        yield {"type": "metadata", "latency_ms": latency_ms, "pipeline": "plain"}
