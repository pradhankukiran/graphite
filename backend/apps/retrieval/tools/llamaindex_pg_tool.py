"""LlamaIndex PropertyGraphIndex tool -- multi-hop graph traversal with vector search."""

import asyncio
import logging
import time

from .base import BaseGraphTool, GraphToolResult, RetrievedContext

logger = logging.getLogger(__name__)


class LlamaIndexPropertyGraphTool(BaseGraphTool):
    """LlamaIndex PropertyGraphIndex -- Multi-hop graph traversal combining vector similarity with graph structure.

    Connects to the existing Neo4j property graph (no ingestion) and uses
    LlamaIndex's ``PropertyGraphIndex.from_existing`` for retrieval.  This is
    particularly effective for complex reasoning queries that benefit from
    traversing multiple hops in the knowledge graph.
    """

    tool_name = "llamaindex_property_graph"
    description = (
        "Multi-hop graph traversal combining vector similarity with graph structure "
        "for complex reasoning"
    )

    # ------------------------------------------------------------------
    # Index construction
    # ------------------------------------------------------------------

    @staticmethod
    def _get_index():  # noqa: ANN205 – returns PropertyGraphIndex
        """Create a LlamaIndex PropertyGraphIndex from the existing Neo4j data."""
        from django.conf import settings
        from llama_index.core import PropertyGraphIndex
        from llama_index.graph_stores.neo4j import Neo4jPropertyGraphStore

        graph_store = Neo4jPropertyGraphStore(
            username=settings.NEO4J_USER,
            password=settings.NEO4J_PASSWORD,
            url=settings.NEO4J_URI,
        )

        # Build from existing graph -- no document ingestion, retrieval only
        index = PropertyGraphIndex.from_existing(
            property_graph_store=graph_store,
        )
        return index

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        document_ids: list[str] | None = None,
    ) -> GraphToolResult:
        start = time.time()
        try:
            index = self._get_index()
            retriever = index.as_retriever(
                include_text=True,
                similarity_top_k=top_k,
            )

            # LlamaIndex retriever.retrieve is synchronous -- run in executor
            loop = asyncio.get_running_loop()
            nodes = await loop.run_in_executor(None, retriever.retrieve, query)

            contexts: list[RetrievedContext] = []
            for node in nodes[:top_k]:
                text = node.text if hasattr(node, "text") else str(node)
                score = node.score if hasattr(node, "score") and node.score is not None else 0.0
                node_meta = node.metadata if hasattr(node, "metadata") else {}

                # If document_ids filter was requested, skip non-matching nodes
                if document_ids and node_meta:
                    doc_id = node_meta.get("document_id")
                    if doc_id and doc_id not in document_ids:
                        continue

                contexts.append(
                    RetrievedContext(
                        text=text,
                        score=score,
                        source="PropertyGraph Traversal",
                        metadata=node_meta,
                    )
                )

            latency = (time.time() - start) * 1000
            return GraphToolResult(
                contexts=contexts,
                tool_name=self.tool_name,
                query=query,
                latency_ms=latency,
                metadata={
                    "traversal_type": "property_graph",
                    "results_count": len(contexts),
                },
            )
        except Exception as e:
            logger.error("LlamaIndex PropertyGraph retrieval failed: %s", e)
            latency = (time.time() - start) * 1000
            return GraphToolResult(
                contexts=[],
                tool_name=self.tool_name,
                query=query,
                latency_ms=latency,
                metadata={"error": str(e)},
            )

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    async def health_check(self) -> bool:
        try:
            from apps.knowledge_graph.neo4j_client import Neo4jClient

            result = await Neo4jClient.health_check()
            return result.get("connected", False)
        except Exception:
            return False
