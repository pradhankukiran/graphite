"""Base abstract class for graph-based retrieval tools."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class RetrievedContext:
    """A single piece of retrieved context."""

    text: str
    score: float = 0.0
    source: str = ""  # document name or chunk reference
    metadata: dict = field(default_factory=dict)


@dataclass
class GraphToolResult:
    """Result from a graph tool query."""

    contexts: list[RetrievedContext]
    tool_name: str
    query: str
    latency_ms: float = 0.0
    metadata: dict = field(default_factory=dict)  # tool-specific metadata (cypher query, traversal path, etc.)


class BaseGraphTool(ABC):
    """Abstract base for graph-based retrieval tools."""

    tool_name: str = ""
    description: str = ""

    @abstractmethod
    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        document_ids: list[str] | None = None,
    ) -> GraphToolResult:
        """Retrieve relevant context for a query."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if this tool is operational."""
        ...
