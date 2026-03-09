"""Embedding service singleton using SentenceTransformers."""

import logging

from django.conf import settings
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Singleton embedding service that lazily loads a SentenceTransformer model.

    The model is loaded once on first use and reused for subsequent calls,
    avoiding repeated model loading overhead in Celery workers.
    """

    _instance = None
    _model: SentenceTransformer | None = None

    @classmethod
    def get_model(cls) -> SentenceTransformer:
        """Get or load the SentenceTransformer model."""
        if cls._model is None:
            model_name = getattr(settings, "EMBEDDING_MODEL", "all-MiniLM-L6-v2")
            logger.info("Loading embedding model: %s", model_name)
            cls._model = SentenceTransformer(model_name)
            logger.info("Embedding model loaded: %s", model_name)
        return cls._model

    @classmethod
    def embed(cls, texts: list[str]) -> list[list[float]]:
        """
        Embed a list of texts and return their vector representations.

        Args:
            texts: List of strings to embed.

        Returns:
            List of embedding vectors (each a list of floats).
        """
        model = cls.get_model()
        embeddings = model.encode(texts, show_progress_bar=False)
        return embeddings.tolist()

    @classmethod
    def embed_single(cls, text: str) -> list[float]:
        """
        Embed a single text string.

        Args:
            text: The string to embed.

        Returns:
            A single embedding vector as a list of floats.
        """
        return cls.embed([text])[0]
