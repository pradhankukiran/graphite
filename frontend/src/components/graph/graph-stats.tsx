'use client';

import * as React from 'react';
import { useGraphStore, buildForceGraphData } from '@/stores/graph';
import { entityColors } from '@/styles/theme';

export function GraphStats() {
  const { stats, graphData, selectedTypes } = useGraphStore();
  const filteredData = React.useMemo(
    () => buildForceGraphData(graphData, selectedTypes),
    [graphData, selectedTypes],
  );

  if (!stats) return null;

  const nodeCount = filteredData?.nodes.length ?? stats.nodeCount;
  const edgeCount = filteredData?.links.length ?? stats.edgeCount;

  return (
    <div className="hidden items-center gap-3 text-sm lg:flex">
      <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/90 px-3 py-1.5 shadow-sm">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
          Visible
        </span>
        <span className="font-semibold tabular-nums text-charcoal">
          {nodeCount.toLocaleString()}
        </span>
        <span className="text-muted-light">nodes</span>
        <span className="text-muted-light">/</span>
        <span className="font-semibold tabular-nums text-charcoal">
          {edgeCount.toLocaleString()}
        </span>
        <span className="text-muted-light">edges</span>
      </div>

      {Object.keys(stats.entityTypes).length > 0 && (
        <div className="flex items-center gap-1.5">
          {Object.entries(stats.entityTypes)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 4)
            .map(([type, count]) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/90 px-2.5 py-1 text-xs text-muted shadow-sm tabular-nums"
                title={`${type}: ${count}`}
              >
                <span
                  className="inline-block h-[7px] w-[7px] rounded-full"
                  style={{ backgroundColor: entityColors[type] || '#8B919A' }}
                />
                {type}
                <span className="font-medium text-charcoal">{count}</span>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
