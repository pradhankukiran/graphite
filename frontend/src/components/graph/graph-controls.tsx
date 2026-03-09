'use client';

import * as React from 'react';
import {
  Orbit,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { useGraphStore, buildForceGraphData } from '@/stores/graph';
import { entityColors } from '@/styles/theme';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GraphSearch } from './graph-search';
import { cn } from '@/lib/utils';

const ENTITY_TYPES = ['Person', 'Organization', 'Location', 'Concept', 'Event', 'Technology'] as const;

interface GraphControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
}

export function GraphControls({ onZoomIn, onZoomOut, onFitView }: GraphControlsProps) {
  const {
    graphData,
    is3D,
    toggle3D,
    selectedTypes,
    setSelectedTypes,
    depth,
    setDepth,
  } = useGraphStore();
  const filteredData = React.useMemo(
    () => buildForceGraphData(graphData, selectedTypes),
    [graphData, selectedTypes],
  );

  const handleTypeToggle = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  return (
    <div className="flex max-h-full w-full flex-col gap-3 overflow-hidden">
      <div className="rounded-[24px] border border-border/70 bg-surface/92 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
              Explore
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-charcoal">
              Graph workspace
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted">
              Search first, then click a node to inspect it and expand its neighborhood.
            </p>
          </div>
          <div className="rounded-full border border-border/60 bg-background/90 p-2 text-teal shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-4">
          <GraphSearch />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-border/60 bg-background/90 px-3 py-2 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Nodes</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-charcoal">
              {filteredData?.nodes.length ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/90 px-3 py-2 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Edges</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-charcoal">
              {filteredData?.links.length ?? 0}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto rounded-[24px] border border-border/70 bg-surface/92 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
              Filters
            </p>
            <h3 className="mt-1 text-sm font-semibold text-charcoal">
              Refine the visible graph
            </h3>
          </div>
          {selectedTypes.length > 0 && (
            <button
              onClick={() => setSelectedTypes([])}
              className="text-xs font-medium text-teal transition-colors hover:text-teal-hover"
            >
              Reset
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {ENTITY_TYPES.map((type) => {
            const isActive = selectedTypes.length === 0 || selectedTypes.includes(type);
            return (
              <button
                key={type}
                onClick={() => handleTypeToggle(type)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all',
                  isActive
                    ? 'border-charcoal/15 bg-background text-charcoal shadow-sm'
                    : 'border-border/60 bg-surface text-muted-light hover:bg-background/80',
                )}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entityColors[type] || '#8B919A' }}
                />
                {type}
              </button>
            );
          })}
        </div>

        <div className="mt-5 border-t border-border/50 pt-4">
          <span className="block text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
            Expansion depth
          </span>
          <div className="mt-3 flex items-center gap-2">
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                className={cn(
                  'flex h-10 min-w-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-all',
                  depth === d
                    ? 'border-teal bg-teal text-white shadow-[0_12px_24px_rgba(0,120,67,0.2)]'
                    : 'border-border/60 bg-background text-charcoal-light hover:bg-background/80',
                )}
              >
                {d}
              </button>
            ))}
            <span className="text-xs text-muted">hops when you expand a node</span>
          </div>
        </div>

        <div className="mt-5 border-t border-border/50 pt-4">
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/90 px-3 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-teal/10 p-2 text-teal">
                <Orbit className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal">3D view</p>
                <p className="text-xs text-muted">
                  {is3D ? 'Spatial camera view' : 'Stable 2D map view'}
                </p>
              </div>
            </div>
            <Switch checked={is3D} onCheckedChange={toggle3D} />
          </div>
        </div>

        <div className="mt-5 border-t border-border/50 pt-4">
          <span className="block text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
            Camera
          </span>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={onZoomIn} title="Zoom in">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={onZoomOut} title="Zoom out">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={onFitView} title="Fit to view">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
