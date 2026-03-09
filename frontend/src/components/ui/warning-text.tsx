import * as React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface WarningTextProps {
  children: React.ReactNode;
  className?: string;
}

export function WarningText({ children, className }: WarningTextProps) {
  return (
    <div className={cn('flex gap-3 items-start', className)}>
      <AlertTriangle className="h-5 w-5 shrink-0 text-charcoal" aria-hidden="true" />
      <div className="text-base text-charcoal">
        <strong className="sr-only">Warning</strong>
        {children}
      </div>
    </div>
  );
}
