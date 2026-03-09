from django.db import models

from apps.core.models import TimestampedModel, UUIDModel


class GraphBuildJob(UUIDModel, TimestampedModel):
    """Tracks the status of a knowledge-graph build job for a document."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        EXTRACTING = "extracting", "Extracting"
        BUILDING = "building", "Building"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    document = models.ForeignKey(
        "documents.Document",
        on_delete=models.CASCADE,
        related_name="graph_jobs",
    )
    celery_task_id = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    entities_extracted = models.IntegerField(default=0)
    relations_extracted = models.IntegerField(default=0)
    entities_created = models.IntegerField(default=0)
    relations_created = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "knowledge_graph_graphbuildjob"
        ordering = ["-created_at"]
        verbose_name = "Graph Build Job"
        verbose_name_plural = "Graph Build Jobs"

    def __str__(self) -> str:
        return f"GraphBuildJob({self.id}) – {self.status}"
