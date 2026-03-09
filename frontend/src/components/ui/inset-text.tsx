import * as React from 'react';
import { cn } from '@/lib/utils';

interface InsetTextProps {
  children: React.ReactNode;
  className?: string;
}

export function InsetText({ children, className }: InsetTextProps) {
  return (
    <div className={cn('border-l-4 border-border pl-4 py-1 text-charcoal-light', className)}>
      {children}
    </div>
  );
}
