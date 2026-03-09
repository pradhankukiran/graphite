"""LangChain Cypher QA tool -- natural language to Cypher query translation."""

import asyncio
import logging
import time

from .base import BaseGraphTool, GraphToolResult, RetrievedContext

logger = logging.getLogger(__name__)


class LangChainCypherTool(BaseGraphTool):
    """LangChain Cypher QA -- Natural language to Cypher query translation.

    Uses LangChain's ``GraphCypherQAChain`` to:
    1. Convert a natural-language question into a Cypher query via an LLM.
    2. Execute the generated Cypher against Neo4j.
    3. Return the answer and raw graph results as ``RetrievedContext`` items.

    LLM provider selection priority:
        GROQ_API_KEY  >  CEREBRAS_API_KEY  >  OPENROUTER_API_KEY
    """

    tool_name = "langchain_cypher"
    description = "Translates natural language questions to Cypher queries for direct graph database access"

    # ------------------------------------------------------------------
    # Chain construction
    # ------------------------------------------------------------------

    @staticmethod
    def _get_chain():  # noqa: ANN205 – returns GraphCypherQAChain
        """Create a LangChain ``GraphCypherQAChain`` wired to Neo4j."""
        import os

        from django.conf import settings
        from langchain_community.chat_models import ChatOpenAI
        from langchain_neo4j import GraphCypherQAChain, Neo4jGraph

        # Resolve an LLM from available API keys
        if os.environ.get("GROQ_API_KEY"):
            llm = ChatOpenAI(
                api_key=os.environ["GROQ_API_KEY"],
                base_url="https://api.groq.com/openai/v1",
                model="openai/gpt-oss-120b",
                temperature=0,
            )
        elif os.environ.get("CEREBRAS_API_KEY"):
            llm = ChatOpenAI(
                api_key=os.environ["CEREBRAS_API_KEY"],
                base_url="https://api.cerebras.ai/v1",
                model="gpt-oss-120b",
                temperature=0,
            )
        elif os.environ.get("OPENROUTER_API_KEY"):
            llm = ChatOpenAI(
                api_key=os.environ["OPENROUTER_API_KEY"],
                base_url="https://openrouter.ai/api/v1",
                model="openai/gpt-oss-120b",
                temperature=0,
            )
        else:
            raise ValueError(
                "No LLM API key configured. "
                "Set one of: GROQ_API_KEY, CEREBRAS_API_KEY, OPENROUTER_API_KEY"
            )

        graph = Neo4jGraph(
            url=settings.NEO4J_URI,
            username=settings.NEO4J_USER,
            password=settings.NEO4J_PASSWORD,
        )

        chain = GraphCypherQAChain.from_llm(
            llm=llm,
            graph=graph,
            verbose=False,
            return_intermediate_steps=True,
            validate_cypher=True,
            top_k=10,
        )
        return chain

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
            chain = self._get_chain()

            # GraphCypherQAChain.invoke is synchronous -- run in the default executor
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(None, lambda: chain.invoke({"query": query}))

            contexts: list[RetrievedContext] = []

            # Primary answer
            answer = result.get("result", "")
            if answer:
                contexts.append(
                    RetrievedContext(
                        text=answer,
                        score=1.0,
                        source="Cypher Query Result",
                        metadata={},
                    )
                )

            # Parse intermediate steps for the generated Cypher and raw DB rows
            intermediate = result.get("intermediate_steps", [])
            cypher_query = ""
            raw_results: list = []

            if intermediate:
                # Step 0: generated cypher query
                if len(intermediate) > 0:
                    step0 = intermediate[0]
                    cypher_query = (
                        step0.get("query", "") if isinstance(step0, dict) else str(step0)
                    )
                # Step 1: raw database results
                if len(intermediate) > 1:
                    step1 = intermediate[1]
                    raw_results = step1 if isinstance(step1, list) else [step1]

                    # Expose each raw row as additional context (capped at top_k)
                    for row in raw_results[:top_k]:
                        if isinstance(row, dict):
                            text = " | ".join(f"{k}: {v}" for k, v in row.items())
                            contexts.append(
                                RetrievedContext(
                                    text=text,
                                    score=0.8,
                                    source="Graph Query",
                                    metadata=row,
                                )
                            )

            latency = (time.time() - start) * 1000
            return GraphToolResult(
                contexts=contexts,
                tool_name=self.tool_name,
                query=query,
                latency_ms=latency,
                metadata={
                    "cypher_query": cypher_query,
                    "results_count": len(contexts),
                },
            )
        except Exception as e:
            logger.error("LangChain Cypher QA failed: %s", e)
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
            from django.conf import settings
            from langchain_neo4j import Neo4jGraph

            graph = Neo4jGraph(
                url=settings.NEO4J_URI,
                username=settings.NEO4J_USER,
                password=settings.NEO4J_PASSWORD,
            )
            graph.refresh_schema()
            return True
        except Exception:
            return False
