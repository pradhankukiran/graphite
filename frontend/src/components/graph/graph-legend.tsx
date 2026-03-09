'use client';

import * as React from 'react';
import { useGraphStore } from '@/stores/graph';
import { entityColors } from '@/styles/theme';
import { cn } from '@/lib/utils';

const ENTITY_TYPES = ['Person', 'Organization', 'Location', 'Concept', 'Event', 'Technology'] as const;

export function GraphLegend() {
  const { selectedTypes, setSelectedTypes } = useGraphStore();

  const handleClick = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {ENTITY_TYPES.map((type) => {
        const isActive = selectedTypes.length === 0 || selectedTypes.includes(type);
        const color = entityColors[type] || '#8B919A';

        return (
          <button
            key={type}
            onClick={() => handleClick(type)}
            className={cn(
              'inline-flex items-center gap-1.5 text-sm transition-opacity',
              isActive ? 'opacity-100' : 'opacity-30 hover:opacity-50',
            )}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-muted">{type}</span>
          </button>
        );
      })}
    </div>
  );
}
