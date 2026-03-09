from django.contrib import admin

from apps.documents.models import Chunk, Document, IngestionJob


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "filename",
        "file_type",
        "status",
        "file_size",
        "chunk_count",
        "entity_count",
        "user",
        "created_at",
    )
    list_filter = ("status", "file_type", "created_at")
    search_fields = ("filename", "user__email")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-created_at",)


@admin.register(Chunk)
class ChunkAdmin(admin.ModelAdmin):
    list_display = ("id", "document", "index", "char_start", "char_end", "created_at")
    list_filter = ("created_at",)
    search_fields = ("document__filename", "text")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("document", "index")


@admin.register(IngestionJob)
class IngestionJobAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "document",
        "status",
        "progress_pct",
        "current_stage",
        "started_at",
        "completed_at",
    )
    list_filter = ("status", "current_stage")
    search_fields = ("document__filename",)
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-created_at",)
