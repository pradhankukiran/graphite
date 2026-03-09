"""Text chunking using recursive character text splitting."""

import logging
import re

logger = logging.getLogger(__name__)

# Separators ordered from largest to smallest semantic unit
_SEPARATORS = [
    "\n\n\n",   # triple newline (section breaks)
    "\n\n",     # paragraph breaks
    "\n",       # line breaks
    ". ",       # sentence boundaries
    "? ",
    "! ",
    "; ",
    ", ",
    " ",        # word boundaries
    "",         # character-level (last resort)
]


def chunk_text(
    text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> list[dict]:
    """
    Split text into overlapping chunks using recursive character text splitting.

    Tries to split on the largest semantic boundary first (paragraphs, then
    sentences, then words) while keeping each chunk within ``chunk_size``
    characters. Adjacent chunks overlap by ``chunk_overlap`` characters.

    Args:
        text: The full text to split.
        chunk_size: Maximum number of characters per chunk.
        chunk_overlap: Number of overlapping characters between consecutive chunks.

    Returns:
        A list of dicts, each with keys:
            - index (int): zero-based chunk index
            - text (str): the chunk text
            - char_start (int): character offset of the chunk start in the original text
            - char_end (int): character offset of the chunk end in the original text
    """
    if not text or not text.strip():
        return []

    if chunk_overlap >= chunk_size:
        chunk_overlap = chunk_size // 4

    splits = _recursive_split(text, _SEPARATORS, chunk_size)

    # Merge small splits back together up to chunk_size
    merged = _merge_splits(splits, chunk_size, chunk_overlap)

    # Build result dicts with character offsets
    chunks: list[dict] = []
    search_start = 0
    for i, chunk_text_str in enumerate(merged):
        # Find the position of this chunk text in the original text
        pos = text.find(chunk_text_str, search_start)
        if pos == -1:
            # Overlap may have caused the text to not match exactly at the search
            # start — try from the beginning, but prefer later positions
            pos = text.find(chunk_text_str)
        if pos == -1:
            # As a final fallback, estimate position
            pos = search_start

        char_start = pos
        char_end = pos + len(chunk_text_str)

        chunks.append(
            {
                "index": i,
                "text": chunk_text_str,
                "char_start": char_start,
                "char_end": char_end,
            }
        )
        # Move search forward (accounting for overlap)
        search_start = max(char_start + 1, char_end - chunk_overlap)

    return chunks


def _recursive_split(
    text: str,
    separators: list[str],
    chunk_size: int,
) -> list[str]:
    """
    Recursively split text using the list of separators.

    Tries the first separator; any resulting segments that are still too long
    are re-split using the remaining separators.
    """
    if len(text) <= chunk_size:
        return [text] if text.strip() else []

    if not separators:
        # Last resort: hard split at chunk_size
        result = []
        for i in range(0, len(text), chunk_size):
            segment = text[i : i + chunk_size]
            if segment.strip():
                result.append(segment)
        return result

    separator = separators[0]
    remaining_separators = separators[1:]

    if not separator:
        # Empty string separator means character-level split
        result = []
        for i in range(0, len(text), chunk_size):
            segment = text[i : i + chunk_size]
            if segment.strip():
                result.append(segment)
        return result

    # Split the text on this separator
    parts = text.split(separator)

    result: list[str] = []
    for part in parts:
        if not part.strip():
            continue
        if len(part) <= chunk_size:
            result.append(part)
        else:
            # This part is still too big; recursively split with finer separators
            sub_splits = _recursive_split(part, remaining_separators, chunk_size)
            result.extend(sub_splits)

    return result


def _merge_splits(
    splits: list[str],
    chunk_size: int,
    chunk_overlap: int,
) -> list[str]:
    """
    Merge small splits into chunks up to chunk_size, with overlap between
    consecutive chunks.
    """
    if not splits:
        return []

    merged: list[str] = []
    current_parts: list[str] = []
    current_length = 0

    for split in splits:
        split_len = len(split)

        # If adding this split would exceed chunk_size, finalize the current chunk
        if current_parts and current_length + split_len + 1 > chunk_size:
            chunk_str = " ".join(current_parts)
            merged.append(chunk_str)

            # Keep trailing parts for overlap
            overlap_parts: list[str] = []
            overlap_len = 0
            for part in reversed(current_parts):
                if overlap_len + len(part) + 1 > chunk_overlap:
                    break
                overlap_parts.insert(0, part)
                overlap_len += len(part) + 1

            current_parts = overlap_parts
            current_length = sum(len(p) for p in current_parts) + max(
                len(current_parts) - 1, 0
            )

        current_parts.append(split)
        current_length += split_len + (1 if len(current_parts) > 1 else 0)

    # Flush the last chunk
    if current_parts:
        merged.append(" ".join(current_parts))

    return merged
