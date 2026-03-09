"""Graph tool factory -- registry and instantiation of retrieval tools."""

from __future__ import annotations

from .base import BaseGraphTool
from .langchain_cypher_tool import LangChainCypherTool
from .llamaindex_pg_tool import LlamaIndexPropertyGraphTool
from .neo4j_graphrag_tool import Neo4jGraphRAGTool

TOOLS: dict[str, type[BaseGraphTool]] = {
    "neo4j_graphrag": Neo4jGraphRAGTool,
    "langchain_cypher": LangChainCypherTool,
    "llamaindex_property_graph": LlamaIndexPropertyGraphTool,
}


def get_tool(name: str, **kwargs) -> BaseGraphTool:
    """Instantiate a graph tool by name.

    Args:
        name: Registered tool name (see ``TOOLS``).
        **kwargs: Forwarded to the tool constructor (e.g. ``search_type``
                  for :class:`Neo4jGraphRAGTool`).

    Returns:
        A ready-to-use :class:`BaseGraphTool` instance.

    Raises:
        ValueError: If *name* is not in the registry.
    """
    cls = TOOLS.get(name)
    if cls is None:
        raise ValueError(
            f"Unknown graph tool: {name!r}. Available: {list(TOOLS.keys())}"
        )
    return cls(**kwargs)


def get_available_tools() -> list[dict]:
    """Return metadata for stable user-facing graph tools.

    Returns:
        A list of dicts, each with ``name`` and ``description`` keys.
    """
    cls = TOOLS["neo4j_graphrag"]
    return [{"name": "neo4j_graphrag", "description": cls().description}]
