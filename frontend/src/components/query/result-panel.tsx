'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge, Button } from '@/components/ui';
import { Copy, Check, Clock, Coins, ChevronDown, FileText, GitFork } from 'lucide-react';
import { StreamingText } from './streaming-text';
import { SourceCitation } from './source-citation';
import type { QueryResult } from '@/types';

interface ResultPanelProps {
  result: QueryResult | null;
  streamedText: string;
  isStreaming: boolean;
  onCancelStream?: () => void;
  className?: string;
}

export function ResultPanel({
  result,
  streamedText,
  isStreaming,
  onCancelStream,
  className,
}: ResultPanelProps) {
  const [copied, setCopied] = React.useState(false);
  const [showSources, setShowSources] = React.useState(false);

  const answer = result?.answer || streamedText;
  const hasAnswer = !!answer;

  const handleCopy = async () => {
    if (!answer) return;
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  if (!hasAnswer && !isStreaming) return null;

  return (
    <div className={cn('space-y-5', className)}>
      {/* Answer section */}
      <div className="animate-slide-in-up">
        {/* Header with mode + copy */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {result?.mode === 'graph' ? (
              <Badge variant="success" size="sm">
                <GitFork className="h-3 w-3 mr-0.5" />
                GraphRAG
              </Badge>
            ) : result?.mode === 'plain' ? (
              <Badge variant="default" size="sm">
                <FileText className="h-3 w-3 mr-0.5" />
                Plain RAG
              </Badge>
            ) : isStreaming ? (
              <Badge variant="success" size="sm" className="animate-pulse-soft">
                generating...
              </Badge>
            ) : null}
          </div>

          {hasAnswer && !isStreaming && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCopy}
              className="text-muted-light hover:text-charcoal"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-teal" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>

        {/* Answer body */}
        <StreamingText
          text={answer}
          isStreaming={isStreaming}
          onCancel={onCancelStream}
        />
      </div>

      {/* Metadata bar */}
      {result && !isStreaming && (
        <div className="flex items-center gap-3 pt-2 border-t border-border/40 animate-fade-in"
             style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-1 text-sm text-muted font-mono tabular-nums">
            <Clock className="h-3 w-3" />
            {result.latency_ms.toLocaleString()}ms
          </div>
          {result.token_usage && (
            <div className="flex items-center gap-1 text-sm text-muted font-mono tabular-nums">
              <Coins className="h-3 w-3" />
              {result.token_usage.total_tokens.toLocaleString()}
            </div>
          )}
          <Badge variant="outline" size="sm" className="font-mono">
            {result.provider}/{result.model}
          </Badge>
        </div>
      )}

      {/* Sources */}
      {result && result.sources.length > 0 && !isStreaming && (
        <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <button
            onClick={() => setShowSources(!showSources)}
            className={cn(
              'flex items-center gap-2 text-sm font-medium transition-colors duration-150',
              showSources ? 'text-charcoal' : 'text-muted hover:text-charcoal',
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            {result.sources.length} sources
            <ChevronDown className={cn(
              'h-3.5 w-3.5 transition-transform duration-200',
              showSources && 'rotate-180',
            )} />
          </button>

          {showSources && (
            <div className="mt-2.5 space-y-2 stagger-children">
              {result.sources.map((source, i) => (
                <SourceCitation key={source.chunk_id} source={source} index={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Graph context */}
      {result?.graph_context && !isStreaming && (
        <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center gap-2 text-sm font-medium text-charcoal mb-2">
            <GitFork className="h-3.5 w-3.5" />
            Graph Context
          </div>
          {result.graph_context.subgraph_summary && (
            <p className="text-base text-muted leading-relaxed">
              {result.graph_context.subgraph_summary}
            </p>
          )}
          {result.graph_context.entities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.graph_context.entities.map((entity) => (
                <Badge key={entity.id} variant="outline" size="sm">
                  {entity.label}
                  <span className="text-muted-light ml-1">{entity.entity_type}</span>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
