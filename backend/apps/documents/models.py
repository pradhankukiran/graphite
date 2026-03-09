from django.db import models

from apps.core.models import TimestampedModel, UUIDModel


class Document(UUIDModel, TimestampedModel):
    """Uploaded document with ingestion status tracking."""

    class Status(models.TextChoices):
        PENDING = "pending"
        PARSING = "parsing"
        CHUNKING = "chunking"
        EMBEDDING = "embedding"
        EXTRACTING = "extracting"
        BUILDING_GRAPH = "building_graph"
        COMPLETED = "completed"
        FAILED = "failed"

    class FileType(models.TextChoices):
        PDF = "pdf"
        TXT = "txt"
        DOCX = "docx"
        HTML = "html"
        MD = "md"

    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="documents"
    )
    filename = models.CharField(max_length=500)
    file_type = models.CharField(max_length=10, choices=FileType.choices)
    file = models.FileField(upload_to="documents/%Y/%m/")
    blob_url = models.URLField(max_length=2048, blank=True, default="")
    blob_download_url = models.URLField(max_length=2048, blank=True, default="")
    blob_pathname = models.CharField(max_length=1024, blank=True, default="")
    file_size = models.BigIntegerField(default=0)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    raw_text = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict)
    chunk_count = models.IntegerField(default=0)
    entity_count = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, default="")

    class Meta:
        db_table = "documents_document"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.filename} ({self.status})"


class Chunk(UUIDModel, TimestampedModel):
    """A text chunk belonging to a document."""

    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="chunks"
    )
    index = models.IntegerField()
    text = models.TextField()
    char_start = models.IntegerField(default=0)
    char_end = models.IntegerField(default=0)
    metadata = models.JSONField(default=dict)
    neo4j_node_id = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        db_table = "documents_chunk"
        ordering = ["document", "index"]
        unique_together = ["document", "index"]

    def __str__(self):
        return f"Chunk {self.index} of {self.document.filename}"


class IngestionJob(UUIDModel, TimestampedModel):
    """Tracks the progress of a document ingestion pipeline."""

    class Status(models.TextChoices):
        PENDING = "pending"
        RUNNING = "running"
        COMPLETED = "completed"
        FAILED = "failed"

    document = models.OneToOneField(
        Document, on_delete=models.CASCADE, related_name="ingestion_job"
    )
    celery_task_id = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    progress_pct = models.IntegerField(default=0)
    current_stage = models.CharField(max_length=50, blank=True, default="")
    stages = models.JSONField(default=list)
    error_message = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "documents_ingestionjob"

    def __str__(self):
        return f"IngestionJob for {self.document.filename} ({self.status})"
