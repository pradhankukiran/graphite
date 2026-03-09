"""Django admin registration for retrieval models."""

from django.contrib import admin

from apps.retrieval.models import QueryResult


@admin.register(QueryResult)
class QueryResultAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "mode",
        "llm_provider",
        "llm_model",
        "graph_tool",
        "total_latency_ms",
        "created_at",
    )
    list_filter = ("mode", "llm_provider", "graph_tool")
    search_fields = ("query_text", "user__email")
    readonly_fields = ("id", "created_at", "updated_at", "results", "token_count")
    ordering = ("-created_at",)
    raw_id_fields = ("user",)
