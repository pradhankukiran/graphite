'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const textareaId = id || React.useId();

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="mb-1.5 block text-sm font-medium text-charcoal"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            'flex min-h-[80px] w-full border-2 border-charcoal bg-surface px-3 py-2 text-sm text-charcoal transition-colors',
            'placeholder:text-muted',
            'focus:outline focus:outline-3 focus:outline-[#ffdd00] focus:shadow-[inset_0_0_0_2px_#0b0c0e]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'resize-y',
            error && 'border-danger focus:border-danger focus:ring-danger/20',
            className,
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p role="alert" className="mt-1 text-xs text-danger">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-xs text-muted">{helperText}</p>
        )}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
