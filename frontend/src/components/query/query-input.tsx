'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ArrowUp, Square } from 'lucide-react';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
  isStreaming: boolean;
  onCancel?: () => void;
}

const MAX_CHARS = 2000;

export function QueryInput({
  onSubmit,
  isLoading,
  isStreaming,
  onCancel,
}: QueryInputProps) {
  const [value, setValue] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const disabled = isLoading || isStreaming;

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || trimmed.length > MAX_CHARS) return;
    onSubmit(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize
  React.useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [value]);

  // Focus on mount
  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="relative">
      <div
        className={cn(
          'relative border-2 bg-surface transition-all duration-200',
          disabled
            ? 'border-border opacity-70'
            : 'border-charcoal focus-within:outline focus-within:outline-3 focus-within:outline-[#ffdd00]',
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          disabled={disabled}
          rows={1}
          className={cn(
            'w-full resize-none bg-transparent pl-5 pr-14 py-4 text-base text-charcoal',
            'placeholder:text-muted-light',
            'focus:outline-none',
            'disabled:cursor-not-allowed',
            'leading-relaxed',
          )}
        />

        {/* Submit / Stop button */}
        <div className="absolute bottom-2.5 right-2.5">
          {isStreaming ? (
            <button
              onClick={onCancel}
              className={cn(
                'flex h-10 w-10 items-center justify-center',
                'bg-charcoal text-white hover:bg-charcoal-light',
                'transition-colors duration-150',
              )}
              aria-label="Stop generating"
            >
              <Square className="h-3.5 w-3.5" fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={disabled || !value.trim()}
              className={cn(
                'flex h-10 w-10 items-center justify-center',
                'transition-all duration-150',
                value.trim() && !disabled
                  ? 'bg-teal text-white hover:bg-teal-hover'
                  : 'bg-charcoal/[0.06] text-muted',
              )}
              aria-label="Send query"
            >
              {isLoading ? (
                <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Hint */}
      <div className="mt-1.5 flex items-center justify-between px-1">
        <span className="text-sm text-muted-light">
          <kbd className="font-mono text-[10px]">Enter</kbd> to send
          <span className="mx-1.5 text-border">|</span>
          <kbd className="font-mono text-[10px]">Shift+Enter</kbd> new line
        </span>
        {value.length > MAX_CHARS * 0.8 && (
          <span className={cn(
            'text-sm tabular-nums font-mono',
            value.length > MAX_CHARS ? 'text-danger' : 'text-muted-light',
          )}>
            {value.length}/{MAX_CHARS}
          </span>
        )}
      </div>
    </div>
  );
}
