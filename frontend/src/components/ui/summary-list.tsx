import * as React from 'react';
import { cn } from '@/lib/utils';

interface SummaryListItem {
  key: string;
  value: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface SummaryListProps {
  items: SummaryListItem[];
  className?: string;
}

export function SummaryList({ items, className }: SummaryListProps) {
  return (
    <dl className={cn('divide-y divide-border', className)}>
      {items.map((item) => (
        <div key={item.key} className="flex gap-4 py-3 sm:py-4">
          <dt className="w-1/3 shrink-0 text-base font-medium text-charcoal">
            {item.key}
          </dt>
          <dd className="flex-1 text-base text-charcoal-light">
            {item.value}
          </dd>
          {item.action && (
            <dd>
              <button
                onClick={item.action.onClick}
                className="text-base text-[#1d70b8] underline hover:text-[#003078]"
              >
                {item.action.label}
              </button>
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}
