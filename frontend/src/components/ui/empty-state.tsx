import * as React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-20 text-center animate-fade-in',
      className,
    )}>
      {Icon && (
        <div className="relative mb-5">
          <div className="absolute inset-0 rounded-full bg-teal/[0.06] blur-xl scale-150" />
          <div className="relative flex h-16 w-16 items-center justify-center bg-gradient-to-b from-surface to-background border border-border">
            <Icon className="h-7 w-7 text-muted" strokeWidth={1.5} />
          </div>
        </div>
      )}
      <h3 className="text-lg font-semibold text-charcoal">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-base text-muted leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
