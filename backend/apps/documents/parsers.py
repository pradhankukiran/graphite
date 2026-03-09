"""Document parsers for extracting plain text from various file types."""

import logging
import os

logger = logging.getLogger(__name__)


def parse_document(file_path: str, file_type: str) -> str:
    """
    Parse a document and return extracted plain text.

    Supports PDF, TXT, DOCX, HTML, and MD file types.
    Uses the ``unstructured`` library when available; falls back to simple
    text reading for plain-text formats (txt, md).

    Args:
        file_path: Absolute path to the file on disk.
        file_type: One of 'pdf', 'txt', 'docx', 'html', 'md'.

    Returns:
        Extracted plain text as a single string.

    Raises:
        ValueError: If the file type is not supported.
        FileNotFoundError: If the file does not exist.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    file_type = file_type.lower().strip(".")

    try:
        return _parse_with_unstructured(file_path, file_type)
    except ImportError:
        logger.warning(
            "unstructured library not available, falling back to simple parser"
        )
        return _parse_simple(file_path, file_type)


def _parse_with_unstructured(file_path: str, file_type: str) -> str:
    """Parse using the unstructured library's partition functions."""
    if file_type == "pdf":
        from unstructured.partition.pdf import partition_pdf

        elements = partition_pdf(filename=file_path)
    elif file_type == "txt":
        from unstructured.partition.text import partition_text

        elements = partition_text(filename=file_path)
    elif file_type == "docx":
        from unstructured.partition.docx import partition_docx

        elements = partition_docx(filename=file_path)
    elif file_type == "html":
        from unstructured.partition.html import partition_html

        elements = partition_html(filename=file_path)
    elif file_type == "md":
        from unstructured.partition.md import partition_md

        elements = partition_md(filename=file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")

    # Join element texts with double newlines to preserve paragraph structure
    text = "\n\n".join(str(el) for el in elements if str(el).strip())
    return text


def _parse_simple(file_path: str, file_type: str) -> str:
    """
    Simple fallback parser for plain-text formats.

    Supports txt, md, html, and PDFs with ``pypdf``. Raises ValueError for
    other binary formats that require the unstructured library.
    """
    if file_type in ("txt", "md"):
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    elif file_type == "pdf":
        from pypdf import PdfReader

        reader = PdfReader(file_path)
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n\n".join(page.strip() for page in pages if page.strip())
        if text:
            return text
        raise ValueError(
            "Could not extract text from PDF with pypdf. "
            "The file may be image-only and require OCR support."
        )
    elif file_type == "html":
        # Attempt basic HTML tag stripping
        import re

        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            html_content = f.read()
        # Remove script and style blocks
        html_content = re.sub(
            r"<(script|style)[^>]*>.*?</\1>", "", html_content, flags=re.DOTALL
        )
        # Remove HTML tags
        text = re.sub(r"<[^>]+>", " ", html_content)
        # Collapse whitespace
        text = re.sub(r"\s+", " ", text).strip()
        return text
    else:
        raise ValueError(
            f"Cannot parse '{file_type}' files without the unstructured library. "
            "Install it with: pip install unstructured"
        )
