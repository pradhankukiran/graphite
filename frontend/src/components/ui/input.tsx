'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helperText, icon, id, ...props }, ref) => {
    const inputId = id || React.useId();

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-2 block text-base font-medium text-charcoal"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              {icon}
            </div>
          )}
          <input
            type={type}
            id={inputId}
            className={cn(
              'flex h-11 w-full border-2 border-charcoal bg-surface px-4 py-3 text-base text-charcoal transition-colors',
              'placeholder:text-muted',
              'focus:border-charcoal focus:outline focus:outline-3 focus:outline-[#ffdd00] focus:shadow-[inset_0_0_0_2px_#0b0c0e]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-danger focus:border-danger',
              icon && 'pl-10',
              className,
            )}
            ref={ref}
            {...props}
          />
        </div>
        {error && (
          <p role="alert" className="mt-1 text-sm text-danger">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-muted">{helperText}</p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
