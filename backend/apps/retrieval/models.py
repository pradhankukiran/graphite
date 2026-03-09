"""Models for the retrieval app — stores query results and metadata."""

from django.db import models

from apps.core.models import TimestampedModel, UUIDModel


class QueryResult(UUIDModel, TimestampedModel):
    """Persisted result of a RAG query, including sources and latency metrics."""

    class Mode(models.TextChoices):
        PLAIN = "plain"
        GRAPH = "graph"
        COMPARE = "compare"

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="queries",
    )
    query_text = models.TextField()
    mode = models.CharField(max_length=10, choices=Mode.choices)
    llm_provider = models.CharField(max_length=50)
    llm_model = models.CharField(max_length=100)
    graph_tool = models.CharField(max_length=50, blank=True, default="")

    # Results stored as JSON
    # {
    #   "plain": {"answer": "...", "sources": [...], "latency_ms": ...},
    #   "graph": {"answer": "...", "sources": [...], "tool_metadata": {...}, "latency_ms": ...},
    # }
    results = models.JSONField(default=dict)

    total_latency_ms = models.FloatField(default=0.0)
    token_count = models.JSONField(default=dict)  # {prompt_tokens, completion_tokens, total_tokens}

    class Meta:
        db_table = "retrieval_queryresult"
        ordering = ["-created_at"]
        verbose_name = "query result"
        verbose_name_plural = "query results"

    def __str__(self) -> str:
        return f"Query({self.mode}): {self.query_text[:60]}"
