'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, FileText } from 'lucide-react';
import type { QuerySource } from '@/types';

interface SourceCitationProps {
  source: QuerySource;
  index: number;
  className?: string;
}

export function SourceCitation({ source, index, className }: SourceCitationProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const scorePercent = Math.round(source.relevance_score * 100);

  return (
    <div
      className={cn(
        'group border border-border overflow-hidden cursor-pointer',
        'transition-all duration-200',
        isExpanded ? 'bg-surface border-charcoal' : 'bg-surface/50 hover:bg-surface hover:border-charcoal',
        className,
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-2.5 px-4 py-3">
        {/* Index */}
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-xs font-semibold
                       bg-teal/[0.08] text-teal tabular-nums">
          {index + 1}
        </span>

        {/* Title */}
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-light" strokeWidth={1.5} />
        <span className="truncate text-sm font-medium text-charcoal-light flex-1">
          {source.document_title}
        </span>

        {/* Score + expand */}
        <span className="text-xs font-mono tabular-nums text-teal shrink-0">
          {scorePercent}%
        </span>
        <ChevronRight className={cn(
          'h-3.5 w-3.5 text-muted-light transition-transform duration-200 shrink-0',
          isExpanded && 'rotate-90',
        )} />
      </div>

      {/* Score bar */}
      <div className="h-[2px] bg-border/30 mx-4">
        <div
          className="h-full bg-teal/40 transition-all duration-500"
          style={{ width: `${scorePercent}%` }}
        />
      </div>

      {/* Preview */}
      {!isExpanded && (
        <p className="px-4 py-2 text-sm text-muted line-clamp-2 leading-relaxed">
          {source.content}
        </p>
      )}

      {/* Expanded */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-border/30">
          <p className="text-base leading-relaxed text-charcoal-light whitespace-pre-wrap">
            {source.content}
          </p>
          <div className="mt-2.5 flex gap-3 text-xs text-muted font-mono">
            {source.page_number != null && <span>page {source.page_number}</span>}
            <span>chunk {source.chunk_id?.slice(0, 8)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
