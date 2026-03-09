'use client';

import * as React from 'react';
import {
  MousePointerClick,
  PanelRightClose,
  PanelRight,
  ScanSearch,
} from 'lucide-react';
import { useGraphStore } from '@/stores/graph';
import {
  GraphCanvas,
  type GraphCanvasHandle,
} from '@/components/graph/graph-canvas';
import { GraphControls } from '@/components/graph/graph-controls';
import { NodeDetailPanel } from '@/components/graph/node-detail-panel';
import { GraphStats } from '@/components/graph/graph-stats';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export default function GraphPage() {
  const fetchGraphData = useGraphStore((state) => state.fetchGraphData);
  const fetchStats = useGraphStore((state) => state.fetchStats);
  const selectedNode = useGraphStore((state) => state.selectedNode);
  const isLoading = useGraphStore((state) => state.isLoading);
  const graphData = useGraphStore((state) => state.graphData);

  const [panelOpen, setPanelOpen] = React.useState(true);
  const graphRef = React.useRef<GraphCanvasHandle>(null);

  React.useEffect(() => {
    fetchGraphData();
    fetchStats();
  }, [fetchGraphData, fetchStats]);

  const handleZoomIn = React.useCallback(() => {
    graphRef.current?.zoomIn();
  }, []);

  const handleZoomOut = React.useCallback(() => {
    graphRef.current?.zoomOut();
  }, []);

  const handleFitView = React.useCallback(() => {
    graphRef.current?.fitView();
  }, []);

  if (isLoading && !graphData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-[13px] text-muted">Loading knowledge graph…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-1px)] flex-col overflow-hidden bg-background">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 bg-surface px-5 py-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted transition-colors hover:text-charcoal"
            title={panelOpen ? 'Hide controls' : 'Show controls'}
            aria-label={panelOpen ? 'Hide graph controls' : 'Show graph controls'}
          >
            {panelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRight className="h-4 w-4" />
            )}
          </button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-charcoal">
              Knowledge Graph
            </h1>
            <p className="mt-1 text-sm text-muted">
              Click to inspect. Expand neighborhoods without losing your place.
            </p>
          </div>
        </div>
        <GraphStats />
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <GraphCanvas ref={graphRef} />

        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto absolute bottom-4 left-4 top-4 z-20 flex w-[min(22rem,calc(100%-2rem))] flex-col gap-3 overflow-hidden">
            <div
              className={cn(
                'transition-all duration-200 ease-out',
                panelOpen
                  ? 'translate-x-0 opacity-100'
                  : '-translate-x-6 opacity-0 pointer-events-none',
              )}
            >
              <GraphControls
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onFitView={handleFitView}
              />
            </div>
          </div>

          {!selectedNode && (
            <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden max-w-sm rounded-[24px] border border-border/60 bg-surface/92 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:block">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-teal/10 p-2 text-teal">
                  <MousePointerClick className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal">
                    Stable graph navigation
                  </p>
                  <p className="mt-1 text-sm leading-5 text-muted">
                    Search for an entity, click a node to inspect it, then expand its neighborhood when you want more context.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedNode && (
            <>
              <div className="pointer-events-auto absolute inset-x-4 bottom-4 top-auto z-20 max-h-[55%] lg:hidden">
                <NodeDetailPanel />
              </div>
              <div className="pointer-events-auto absolute bottom-4 right-4 top-4 z-20 hidden w-[min(24rem,calc(100%-2rem))] lg:block">
                <NodeDetailPanel />
              </div>
            </>
          )}

          <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden rounded-[22px] border border-border/60 bg-surface/92 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl md:block">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-background/90 p-2 text-teal">
                <ScanSearch className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-charcoal">
                  Search, inspect, expand
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Right-click still expands immediately. The node drawer keeps the canvas fixed, so the graph no longer jumps when details open.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
