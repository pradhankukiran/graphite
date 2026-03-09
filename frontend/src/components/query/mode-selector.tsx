'use client';

import { cn } from '@/lib/utils';
import { useQueryStore } from '@/stores/query';
import { Search, GitFork } from 'lucide-react';
import type { QueryMode } from '@/types';

const modes: {
  value: QueryMode;
  label: string;
  icon: typeof Search;
}[] = [
  { value: 'plain', label: 'RAG', icon: Search },
  { value: 'graph', label: 'GraphRAG', icon: GitFork },
];

export function ModeSelector() {
  const { mode, setMode } = useQueryStore();

  return (
    <div className="inline-flex items-center border border-border p-1">
      {modes.map((m) => {
        const Icon = m.icon;
        const isActive = mode === m.value;

        return (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={cn(
              'relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium',
              'transition-all duration-200',
              isActive
                ? 'bg-charcoal text-white'
                : 'text-muted hover:text-charcoal-light hover:bg-charcoal/[0.04]',
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={isActive ? 2 : 1.8} />
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
