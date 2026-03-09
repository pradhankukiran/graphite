'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { Square } from 'lucide-react';
import { SimpleMarkdown } from './simple-markdown';

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
  onCancel?: () => void;
  className?: string;
}

export function StreamingText({ text, isStreaming, onCancel, className }: StreamingTextProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, isStreaming]);

  return (
    <div className={cn('relative', className)}>
      <div
        ref={containerRef}
        className="max-h-[500px] overflow-y-auto"
      >
        <div className="text-[14px] text-charcoal leading-[1.7]">
          <SimpleMarkdown text={text} />
          {isStreaming && (
            <span className="inline-block h-[18px] w-[2px] bg-teal ml-0.5 align-middle animate-cursor-blink" />
          )}
        </div>
      </div>

      {isStreaming && onCancel && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="xs"
            onClick={onCancel}
            className="gap-1 text-muted hover:text-charcoal"
          >
            <Square className="h-2.5 w-2.5" fill="currentColor" />
            Stop
          </Button>
        </div>
      )}
    </div>
  );
}
