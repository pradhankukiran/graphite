'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ErrorSummaryError {
  id: string;
  message: string;
}

interface ErrorSummaryProps {
  errors: ErrorSummaryError[];
  className?: string;
}

export function ErrorSummary({ errors, className }: ErrorSummaryProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    ref.current?.focus();
  }, [errors]);

  if (errors.length === 0) return null;

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className={cn(
        'border-l-4 border-danger bg-danger-light p-5',
        'focus:outline focus:outline-3 focus:outline-[#ffdd00]',
        className,
      )}
    >
      <h2 className="text-lg font-bold text-charcoal">There is a problem</h2>
      <ul className="mt-3 list-none space-y-1">
        {errors.map((error) => (
          <li key={error.id}>
            <a
              href={`#${error.id}`}
              className="text-danger underline hover:text-danger/80"
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
