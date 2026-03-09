"""Abstract base class for RAG pipelines."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator


@dataclass
class PipelineResult:
    """Structured output from a pipeline execution."""

    answer: str
    sources: list[dict]  # [{text, score, source, metadata}]
    latency_ms: float = 0.0
    tool_metadata: dict = field(default_factory=dict)
    token_count: dict = field(default_factory=dict)


class BasePipeline(ABC):
    """Every RAG pipeline must implement execute() and stream()."""

    @abstractmethod
    async def execute(self, query: str, **kwargs) -> PipelineResult:
        """Run the full pipeline and return a complete result."""
        ...

    @abstractmethod
    async def stream(self, query: str, **kwargs) -> AsyncIterator[str | dict]:
        """Yield either string chunks (answer tokens) or dict metadata events."""
        ...
