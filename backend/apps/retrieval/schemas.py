"""Django Ninja schemas for the retrieval / query API."""

from __future__ import annotations

from ninja import Schema


class QueryIn(Schema):
    """Input payload for executing a RAG query."""

    query: str
    mode: str = "graph"  # plain or graph
    provider: str = ""  # auto-detect if empty
    model: str = ""  # use provider default if empty
    graph_tool: str = "neo4j_graphrag"  # graph retrieval engine
    top_k: int = 5
    document_ids: list[str] | None = None
    temperature: float = 0.7


class SourceOut(Schema):
    """A single source citation returned alongside an answer."""

    text: str
    score: float
    source: str
    metadata: dict = {}


class PipelineResultOut(Schema):
    """Result from a single pipeline (plain or graph)."""

    answer: str
    sources: list[SourceOut]
    latency_ms: float
    tool_metadata: dict = {}
    token_count: dict = {}


class QueryResultOut(Schema):
    """Full query result returned to the client."""

    id: str
    query: str
    mode: str
    provider: str
    model: str
    graph_tool: str
    plain_result: PipelineResultOut | None = None
    graph_result: PipelineResultOut | None = None
    total_latency_ms: float
    created_at: str


class QueryHistoryOut(Schema):
    """Lightweight query record for the history listing."""

    id: str
    query: str
    mode: str
    provider: str
    model: str
    total_latency_ms: float
    created_at: str

    @staticmethod
    def resolve_id(obj):
        if isinstance(obj, dict):
            value = obj.get("id", "")
        else:
            value = getattr(obj, "id", "")
        return str(value)

    @staticmethod
    def resolve_query(obj):
        if isinstance(obj, dict):
            return obj.get("query_text", obj.get("query", ""))
        return getattr(obj, "query_text", "")

    @staticmethod
    def resolve_provider(obj):
        if isinstance(obj, dict):
            return obj.get("llm_provider", obj.get("provider", ""))
        return getattr(obj, "llm_provider", "")

    @staticmethod
    def resolve_model(obj):
        if isinstance(obj, dict):
            return obj.get("llm_model", obj.get("model", ""))
        return getattr(obj, "llm_model", "")

    @staticmethod
    def resolve_created_at(obj):
        if isinstance(obj, dict):
            value = obj.get("created_at", "")
        else:
            value = getattr(obj, "created_at", "")

        return value.isoformat() if hasattr(value, "isoformat") else str(value)


class LLMProviderOut(Schema):
    """Description of an LLM provider and its readiness."""

    name: str
    display_name: str
    configured: bool
    models: list[dict]


class GraphToolOut(Schema):
    """Description of a graph retrieval tool."""

    name: str
    description: str


class SettingsOut(Schema):
    """Aggregate settings response."""

    providers: list[LLMProviderOut]
    tools: list[GraphToolOut]
