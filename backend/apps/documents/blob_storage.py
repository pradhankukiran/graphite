"""Optional Vercel Blob helpers for document uploads and ingestion."""

import logging
import mimetypes
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)


def is_blob_enabled() -> bool:
    """Return True when Vercel Blob should be used in addition to local storage."""
    return bool(
        getattr(settings, "VERCEL_BLOB_ENABLED", False)
        and getattr(settings, "BLOB_READ_WRITE_TOKEN", "")
    )


def _get_blob_client():
    token = getattr(settings, "BLOB_READ_WRITE_TOKEN", "")
    if not token:
        raise ImproperlyConfigured(
            "BLOB_READ_WRITE_TOKEN must be set when Vercel Blob is enabled."
        )

    from vercel.blob import BlobClient

    return BlobClient(token=token)


def _get_blob_access() -> str:
    return getattr(settings, "VERCEL_BLOB_ACCESS", "public")


def build_blob_path(document) -> str:
    """Build a deterministic blob pathname for a document."""
    prefix = getattr(settings, "VERCEL_BLOB_PATH_PREFIX", "documents").strip("/")
    filename = Path(document.filename).name
    return f"{prefix}/{document.user_id}/{document.id}/{filename}"


def upload_document_blob(document) -> dict[str, str]:
    """Upload the saved local document file to Vercel Blob."""
    local_path = Path(document.file.path)
    if not local_path.exists():
        raise FileNotFoundError(f"Local document file not found: {local_path}")

    client = _get_blob_client()
    content_type = mimetypes.guess_type(document.filename)[0]
    result = client.upload_file(
        local_path,
        build_blob_path(document),
        access=_get_blob_access(),
        content_type=content_type,
        overwrite=True,
    )
    return {
        "blob_url": result.url,
        "blob_download_url": result.download_url,
        "blob_pathname": result.pathname,
    }


def delete_document_blob(document) -> None:
    """Delete a document blob when one exists."""
    target = document.blob_pathname or document.blob_url
    if not target:
        return

    client = _get_blob_client()
    client.delete(target)


@contextmanager
def open_document_path(document):
    """Yield a local file path for parsing, downloading from Blob when present."""
    if document.blob_pathname and is_blob_enabled():
        suffix = Path(document.filename).suffix or f".{document.file_type}"
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_file.close()
        temp_path = temp_file.name

        try:
            _get_blob_client().download_file(
                document.blob_pathname,
                temp_path,
                access=_get_blob_access(),
                overwrite=True,
            )
            try:
                yield temp_path
                return
            finally:
                try:
                    os.unlink(temp_path)
                except FileNotFoundError:
                    pass
        except Exception:
            logger.warning(
                "Failed to download blob for document %s, falling back to local file",
                document.id,
                exc_info=True,
            )
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass

    if document.file:
        file_path = document.file.path
        if os.path.exists(file_path):
            yield file_path
            return

    raise FileNotFoundError(
        f"No accessible file found for document {document.id} ({document.filename})"
    )
