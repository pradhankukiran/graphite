'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { Search, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { documents as documentsApi } from '@/lib/api/endpoints';
import type { Chunk } from '@/types';

// ── highlight helper ─────────────────────────────

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-warning/30 px-0.5 text-charcoal"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

// ── single chunk row ─────────────────────────────

interface ChunkRowProps {
  chunk: Chunk;
  searchQuery: string;
}

function ChunkRow({ chunk, searchQuery }: ChunkRowProps) {
  const [expanded, setExpanded] = useState(false);
  const TRUNCATE_LENGTH = 300;

  const isTruncatable = chunk.content.length > TRUNCATE_LENGTH;
  const displayText =
    expanded || !isTruncatable
      ? chunk.content
      : chunk.content.slice(0, TRUNCATE_LENGTH) + '...';

  return (
    <div className="border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center bg-teal-light text-xs font-medium text-teal">
            {chunk.chunk_index + 1}
          </span>
          <span className="text-sm text-muted">
            {chunk.token_count} tokens
          </span>
          {chunk.page_number != null && (
            <span className="text-sm text-muted">
              Page {chunk.page_number}
            </span>
          )}
        </div>
        {isTruncatable && (
          <button
            type="button"
            className="flex items-center gap-1 text-sm text-teal hover:underline"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                Collapse <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Expand <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-charcoal-light">
        {highlightText(displayText, searchQuery)}
      </p>
    </div>
  );
}

// ── component ────────────────────────────────────

interface ChunkViewerProps {
  documentId: string;
}

export function ChunkViewer({ documentId }: ChunkViewerProps) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const PAGE_SIZE = 20;

  const fetchChunks = useCallback(
    async (pageNum: number, append = false) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const response = await documentsApi.getChunks(documentId, {
          page: pageNum,
          page_size: PAGE_SIZE,
        });
        setChunks((prev) =>
          append ? [...prev, ...response.results] : response.results,
        );
        setHasMore(pageNum < response.total_pages);
        setPage(pageNum);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [documentId],
  );

  useEffect(() => {
    fetchChunks(1);
  }, [fetchChunks]);

  const loadMore = () => {
    fetchChunks(page + 1, true);
  };

  // Client-side search filter
  const filtered = search.trim()
    ? chunks.filter((c) =>
        c.content.toLowerCase().includes(search.toLowerCase()),
      )
    : chunks;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-teal" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <Input
        placeholder="Search within chunks..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        icon={<Search className="h-4 w-4" />}
      />

      {/* Chunk count */}
      <p className="text-sm text-muted">
        Showing {filtered.length} of {chunks.length} chunks
        {hasMore && ' (more available)'}
      </p>

      {/* Chunk list */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {chunks.length === 0
            ? 'No chunks available yet.'
            : 'No chunks match your search.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((chunk) => (
            <ChunkRow
              key={chunk.id}
              chunk={chunk}
              searchQuery={search}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !search.trim() && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            loading={loadingMore}
          >
            Load More Chunks
          </Button>
        </div>
      )}
    </div>
  );
}
