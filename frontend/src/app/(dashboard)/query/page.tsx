'use client';

import * as React from 'react';
import { useQueryStore } from '@/stores/query';
import { ModeSelector } from '@/components/query/mode-selector';
import { ProviderSelector } from '@/components/query/provider-selector';
import { QueryInput } from '@/components/query/query-input';
import { ResultPanel } from '@/components/query/result-panel';
import { Clock, Search, GitFork, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'What are the main entities in my documents?',
  'How are the organizations connected?',
  'Summarize the key findings',
  'What technologies are mentioned?',
];

export default function QueryPage() {
  const {
    mode,
    isLoading,
    isStreaming,
    streamedText,
    plainResult,
    graphResult,
    history,
    error,
    streamQuery,
    cancelStream,
    fetchHistory,
    clearError,
  } = useQueryStore();

  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  const handleSubmit = async (queryText: string) => {
    clearError();
    await streamQuery(queryText);
    fetchHistory(1);
  };

  const currentResult = mode === 'plain' ? plainResult : graphResult;
  const hasResult = currentResult || streamedText || isStreaming;
  const recentHistory = history.slice(0, 5);

  // Auto-scroll to results
  React.useEffect(() => {
    if ((isStreaming || hasResult) && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [isStreaming, hasResult, streamedText]);

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable content area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-10 py-10">

          {/* Hero state when no results */}
          {!hasResult && !isLoading && !error && (
            <div className="flex flex-col items-center pt-12 pb-8 animate-fade-in">
              <h1 className="text-3xl font-semibold tracking-tight text-charcoal">
                Ask anything about your documents
              </h1>
              <p className="mt-2 text-base text-muted max-w-md text-center leading-relaxed">
                Switch between straight vector retrieval and graph reasoning over your extracted entities.
              </p>

              {/* Suggestion chips */}
              <div className="mt-8 flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSubmit(s)}
                    className={cn(
                      'group flex items-center gap-1.5 border border-border bg-surface px-4 py-2.5',
                      'text-sm text-muted hover:text-charcoal hover:border-charcoal/30 hover:bg-charcoal/[0.03]',
                      'transition-all duration-200 shadow-xs hover:shadow-sm',
                    )}
                  >
                    <span>{s}</span>
                    <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                  </button>
                ))}
              </div>

              {/* Recent history */}
              {recentHistory.length > 0 && (
                <div className="mt-12 w-full max-w-md">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-3.5 w-3.5 text-muted" />
                    <span className="text-sm font-medium uppercase tracking-wider text-muted">Recent</span>
                  </div>
                  <div className="space-y-1 stagger-children">
                    {recentHistory.map((item) => (
                      <RecentQueryRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-danger/20 bg-danger-light px-4 py-3 animate-fade-in">
              <AlertCircle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-danger">Something went wrong</p>
                <p className="text-sm text-danger/70 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Results */}
          {(hasResult || isStreaming) && (
            <div className="animate-fade-in">
              <ResultPanel
                result={currentResult}
                streamedText={streamedText}
                isStreaming={isStreaming}
                onCancelStream={cancelStream}
              />
            </div>
          )}

          {/* Bottom padding for pinned input */}
          <div className="h-8" />
        </div>
      </div>

      {/* Pinned bottom bar */}
      <div className="shrink-0 border-t border-border/40 bg-gradient-to-t from-background via-background to-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-10 py-4">
          {/* Controls row */}
          <div className="flex items-center justify-between mb-3">
            <ModeSelector />
            <ProviderSelector />
          </div>

          {/* Input */}
          <QueryInput
            onSubmit={handleSubmit}
            isLoading={isLoading}
            isStreaming={isStreaming}
            onCancel={cancelStream}
          />
        </div>
      </div>
    </div>
  );
}

function RecentQueryRow({
  item,
}: {
  item: {
    id: string;
    query: string;
    mode: string;
    latency_ms: number;
  };
}) {
  const ModeIcon = item.mode === 'graph' ? GitFork : Search;

  return (
    <div className={cn(
      'group flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer',
      'transition-colors duration-150 hover:bg-surface',
    )}>
      <ModeIcon className="h-3.5 w-3.5 text-muted shrink-0" strokeWidth={1.8} />
      <span className="text-[13px] text-charcoal-light truncate flex-1 group-hover:text-charcoal transition-colors">
        {item.query}
      </span>
      <span className="text-sm text-muted-light tabular-nums shrink-0 font-mono">
        {item.latency_ms}ms
      </span>
    </div>
  );
}
