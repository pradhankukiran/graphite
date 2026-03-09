from django.contrib import admin

from apps.knowledge_graph.models import GraphBuildJob


@admin.register(GraphBuildJob)
class GraphBuildJobAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "document",
        "status",
        "entities_extracted",
        "relations_extracted",
        "entities_created",
        "relations_created",
        "started_at",
        "completed_at",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("id", "document__id", "celery_task_id")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "started_at",
        "completed_at",
    )
    ordering = ("-created_at",)
