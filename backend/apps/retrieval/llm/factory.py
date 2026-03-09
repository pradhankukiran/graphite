"""Factory for creating and discovering LLM providers."""

from __future__ import annotations

import logging

from .base import BaseLLMProvider
from .cerebras import CerebrasProvider
from .groq import GroqProvider
from .openrouter import OpenRouterProvider

logger = logging.getLogger(__name__)

PROVIDERS: dict[str, type[BaseLLMProvider]] = {
    "groq": GroqProvider,
    "cerebras": CerebrasProvider,
    "openrouter": OpenRouterProvider,
}


def get_provider(name: str) -> BaseLLMProvider:
    """Get an LLM provider by name.

    Raises:
        ValueError: If the provider name is unknown or not configured.
    """
    cls = PROVIDERS.get(name.lower())
    if not cls:
        raise ValueError(
            f"Unknown provider: {name}. Available: {list(PROVIDERS.keys())}"
        )
    provider = cls()
    if not provider.is_configured():
        raise ValueError(
            f"Provider {name} is not configured. Please set the required API key."
        )
    return provider


def get_available_providers() -> list[dict]:
    """Return all providers with their configuration status and available models."""
    result = []
    for name, cls in PROVIDERS.items():
        provider = cls()
        result.append(
            {
                "name": name,
                "display_name": provider.provider_name,
                "configured": provider.is_configured(),
                "models": provider.get_available_models()
                if provider.is_configured()
                else [],
            }
        )
    return result


def get_default_provider() -> BaseLLMProvider | None:
    """Get the first configured provider (preference: groq > cerebras > openrouter)."""
    for name in ["groq", "cerebras", "openrouter"]:
        try:
            return get_provider(name)
        except ValueError:
            continue
    logger.warning("No LLM providers are configured. Set at least one API key.")
    return None
