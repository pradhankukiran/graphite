'use client';

import { FileText, Layers, Network, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardsProps {
  totalDocuments: number;
  totalChunks: number;
  totalEntities: number;
  processing: number;
}

export function StatsCards({
  totalDocuments,
  totalChunks,
  totalEntities,
  processing,
}: StatsCardsProps) {
  const stats = [
    { label: 'Documents', value: totalDocuments, icon: FileText },
    { label: 'Chunks', value: totalChunks, icon: Layers },
    { label: 'Entities', value: totalEntities, icon: Network },
    { label: 'Processing', value: processing, icon: Loader2, pulse: processing > 0 },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 stagger-children">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 border border-border bg-surface px-5 py-4
                     transition-all duration-200 hover:border-charcoal"
        >
          <div className={cn(
            'flex h-10 w-10 items-center justify-center',
            stat.pulse
              ? 'bg-warning/10 animate-pulse-soft'
              : 'bg-charcoal/[0.04]',
          )}>
            <stat.icon className={cn(
              'h-4 w-4',
              stat.pulse ? 'text-warning' : 'text-muted',
            )} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-xl font-semibold text-charcoal tabular-nums leading-none">
              {stat.value.toLocaleString()}
            </p>
            <p className="text-sm text-muted mt-0.5">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
