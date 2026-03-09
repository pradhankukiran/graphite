'use client';

import * as React from 'react';
import { useQueryStore } from '@/stores/query';
import { Button, EmptyState, Spinner } from '@/components/ui';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  GitFork,
  Search,
} from 'lucide-react';
import { SimpleMarkdown } from '@/components/query/simple-markdown';
import { SourceCitation } from '@/components/query/source-citation';
import { cn } from '@/lib/utils';
import type { QueryMode, QueryResult } from '@/types';

const MODE_LABELS: Record<'all' | QueryMode, string> = {
  all: 'All',
  plain: 'Plain RAG',
  graph: 'GraphRAG',
};

export default function HistoryPage() {
  const {
    history,
    historyPage,
    historyTotalPages,
    isHistoryLoading,
    fetchHistory,
  } =
    useQueryStore();

  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [modeFilter, setModeFilter] = React.useState<QueryMode | 'all'>('all');

  React.useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  const handlePageChange = (page: number) => {
    fetchHistory(page);
    setExpandedId(null);
  };

  const filtered = history.filter((item) => {
    const matchesSearch =
      !searchTerm || item.query.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMode = modeFilter === 'all' || item.mode === modeFilter;
    return matchesSearch && matchesMode;
  });

  return (
    <div className="max-w-4xl px-10 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-charcoal">History</h1>
        <p className="mt-1 text-base text-muted">
          Browse past RAG and GraphRAG queries.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search queries…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-11 w-full rounded-md border border-border/40 bg-surface pl-8 pr-3 text-base
                       text-charcoal placeholder:text-muted-light transition-all duration-150
                       focus:border-charcoal/40 focus:outline-none focus:ring-2 focus:ring-[#ffdd00]/40"
          />
        </div>

        <div className="flex items-center border border-border/40 bg-surface p-0.5">
          {(['all', 'plain', 'graph'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setModeFilter(mode)}
              className={cn(
                'px-3.5 py-2 text-sm font-medium transition-all',
                modeFilter === mode
                  ? 'bg-charcoal text-white shadow-xs'
                  : 'text-muted hover:text-charcoal',
              )}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>

        <span className="ml-auto text-sm text-muted tabular-nums">
          {filtered.length} quer{filtered.length !== 1 ? 'ies' : 'y'}
        </span>
      </div>

      {isHistoryLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {!isHistoryLoading && filtered.length === 0 && (
        <EmptyState
          icon={Clock}
          title={searchTerm || modeFilter !== 'all' ? 'No matches' : 'No history yet'}
          description={
            searchTerm || modeFilter !== 'all'
              ? 'Try a different search or filter.'
              : 'Your past queries will appear here.'
          }
        />
      )}

      {!isHistoryLoading && filtered.length > 0 && (
        <div className="space-y-1.5 stagger-children">
          {filtered.map((item) => (
            <HistoryItem
              key={item.id}
              item={item}
              isExpanded={expandedId === item.id}
              onToggle={() =>
                setExpandedId(expandedId === item.id ? null : item.id)
              }
            />
          ))}
        </div>
      )}

      {historyTotalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-6">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handlePageChange(historyPage - 1)}
            disabled={historyPage <= 1}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-sm text-muted tabular-nums">
            {historyPage} / {historyTotalPages}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handlePageChange(historyPage + 1)}
            disabled={historyPage >= historyTotalPages}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function HistoryItem({
  item,
  isExpanded,
  onToggle,
}: {
  item: QueryResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const ModeIcon = item.mode === 'graph' ? GitFork : Search;
  const timeAgo = getTimeAgo(item.created_at);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border transition-all duration-200',
        isExpanded
          ? 'border-border/60 bg-surface shadow-sm'
          : 'border-border/30 bg-surface hover:border-border/50',
      )}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            item.mode === 'graph' ? 'bg-[#00703c]' : 'bg-muted-light',
          )}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium text-charcoal">{item.query}</p>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-muted">
            <span className="capitalize">{item.mode}</span>
            <span className="text-muted-light">·</span>
            <span className="font-mono tabular-nums">
              {item.latency_ms.toLocaleString()}ms
            </span>
            <span className="text-muted-light">·</span>
            <span>{timeAgo}</span>
          </div>
        </div>

        <ModeIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-light transition-transform duration-200',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      {isExpanded && (
        <div className="space-y-3 border-t border-border/40 px-4 py-3 animate-fade-in">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted">
              Answer
            </span>
            <div className="mt-1 rounded-md bg-background p-3">
              <SimpleMarkdown text={item.answer} />
            </div>
          </div>

          {item.sources.length > 0 && (
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted">
                Sources · {item.sources.length}
              </span>
              <div className="mt-1 space-y-1">
                {item.sources.map((source, index) => (
                  <SourceCitation key={source.chunk_id} source={source} index={index} />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1 text-sm text-muted-light tabular-nums">
            <span className="font-mono">{item.id.slice(0, 8)}</span>
            <span>·</span>
            <span>
              {item.provider}/{item.model}
            </span>
            {item.token_usage && (
              <>
                <span>·</span>
                <span>{item.token_usage.total_tokens.toLocaleString()} tokens</span>
              </>
            )}
            <span>·</span>
            <span>{new Date(item.created_at).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(isoString: string) {
  const timestamp = new Date(isoString).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
