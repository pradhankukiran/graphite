"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator


@dataclass
class LLMResponse:
    """Structured response from an LLM provider."""

    content: str
    model: str
    provider: str
    usage: dict = field(default_factory=dict)  # {prompt_tokens, completion_tokens, total_tokens}
    latency_ms: float = 0.0


class BaseLLMProvider(ABC):
    """
    Abstract base for LLM providers.

    All providers use the OpenAI-compatible chat completions API via the
    ``openai`` Python SDK, differing only in base_url, API key, and
    available model catalogue.
    """

    provider_name: str = ""

    @abstractmethod
    async def generate(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        system_prompt: str | None = None,
    ) -> LLMResponse:
        """Generate a complete response."""
        ...

    @abstractmethod
    async def stream(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        system_prompt: str | None = None,
    ) -> AsyncIterator[str]:
        """Stream response tokens."""
        ...

    @abstractmethod
    def get_available_models(self) -> list[dict]:
        """Return list of available models with metadata."""
        ...

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if this provider has valid API credentials."""
        ...
