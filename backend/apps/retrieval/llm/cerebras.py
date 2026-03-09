"""Cerebras LLM provider — fast wafer-scale inference."""

import logging
import os
import time
from typing import AsyncIterator

from openai import AsyncOpenAI, APIError

from .base import BaseLLMProvider, LLMResponse

logger = logging.getLogger(__name__)

CEREBRAS_MODELS = [
    {
        "id": "gpt-oss-120b",
        "name": "GPT OSS 120B",
        "context_window": 128_000,
        "premium": False,
    },
]

DEFAULT_MODEL = "gpt-oss-120b"


class CerebrasProvider(BaseLLMProvider):
    """Cerebras cloud inference via OpenAI-compatible API."""

    provider_name = "Cerebras"

    def __init__(self) -> None:
        self._api_key = os.environ.get("CEREBRAS_API_KEY", "")
        self._client: AsyncOpenAI | None = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_client(self) -> AsyncOpenAI:
        """Lazily create and cache the async client."""
        if self._client is None:
            if not self._api_key:
                raise ValueError("CEREBRAS_API_KEY is not set")
            self._client = AsyncOpenAI(
                api_key=self._api_key,
                base_url="https://api.cerebras.ai/v1",
            )
        return self._client

    @staticmethod
    def _prepare_messages(
        messages: list[dict],
        system_prompt: str | None = None,
    ) -> list[dict]:
        """Prepend a system message if one was provided and not already present."""
        if system_prompt:
            has_system = any(m.get("role") == "system" for m in messages)
            if not has_system:
                return [{"role": "system", "content": system_prompt}, *messages]
        return list(messages)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        system_prompt: str | None = None,
    ) -> LLMResponse:
        client = self._get_client()
        resolved_model = model or DEFAULT_MODEL
        prepared = self._prepare_messages(messages, system_prompt)

        start = time.perf_counter()
        try:
            response = await client.chat.completions.create(
                model=resolved_model,
                messages=prepared,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except APIError as exc:
            logger.error("Cerebras API error: %s", exc)
            raise
        latency_ms = (time.perf_counter() - start) * 1000

        choice = response.choices[0]
        usage = {}
        if response.usage:
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            }

        return LLMResponse(
            content=choice.message.content or "",
            model=resolved_model,
            provider=self.provider_name,
            usage=usage,
            latency_ms=latency_ms,
        )

    async def stream(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        system_prompt: str | None = None,
    ) -> AsyncIterator[str]:
        client = self._get_client()
        resolved_model = model or DEFAULT_MODEL
        prepared = self._prepare_messages(messages, system_prompt)

        try:
            response = await client.chat.completions.create(
                model=resolved_model,
                messages=prepared,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
        except APIError as exc:
            logger.error("Cerebras streaming API error: %s", exc)
            raise

        async for chunk in response:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                yield delta.content

    def get_available_models(self) -> list[dict]:
        return list(CEREBRAS_MODELS)

    def is_configured(self) -> bool:
        return bool(self._api_key)
