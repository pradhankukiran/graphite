'use client';

import * as React from 'react';
import {
  X,
  Expand,
  FileText,
} from 'lucide-react';
import { useGraphStore } from '@/stores/graph';
import { entityColors } from '@/styles/theme';
import { Button } from '@/components/ui/button';

export function NodeDetailPanel() {
  const {
    selectedNode,
    setSelectedNode,
    fetchNeighborhood,
    getConnectedNodes,
    isLoading,
  } = useGraphStore();

  const connections = React.useMemo(() => {
    if (!selectedNode) return [];
    return getConnectedNodes(selectedNode.id);
  }, [selectedNode, getConnectedNodes]);

  if (!selectedNode) return null;

  const entityColor = entityColors[selectedNode.type] || '#8B919A';

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[28px] border border-border/70 bg-surface/94 shadow-[0_28px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
      <div className="border-b border-border/50 px-5 py-4">
        <div className="flex items-start gap-3">
          <div
            className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${entityColor}16` }}
          >
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: entityColor }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
              Selected entity
            </p>
            <h3 className="mt-1 truncate text-xl font-semibold tracking-tight text-charcoal">
              {selectedNode.name}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  backgroundColor: `${entityColor}14`,
                  color: entityColor,
                }}
              >
                {selectedNode.type}
              </span>
              <span className="inline-flex items-center rounded-full border border-border/60 bg-background/90 px-2.5 py-1 text-xs text-muted">
                {connections.length} connections in view
              </span>
            </div>
          </div>
          <button
            onClick={() => setSelectedNode(null)}
            className="rounded-full p-2 text-muted-light transition-colors hover:bg-background hover:text-charcoal"
            aria-label="Close selected node details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {selectedNode.description && (
          <div className="rounded-2xl border border-border/60 bg-background/85 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">
              Description
            </p>
            <p className="mt-2 text-sm leading-6 text-charcoal-light">
              {selectedNode.description}
            </p>
          </div>
        )}

        {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
          <div className="mt-4 rounded-2xl border border-border/60 bg-background/85 p-4 shadow-sm">
            <span className="block text-xs font-medium uppercase tracking-[0.22em] text-muted">
              Properties
            </span>
            <div className="mt-3 space-y-2">
              {Object.entries(selectedNode.properties)
                .filter(([key]) => key !== 'description')
                .map(([key, value]) => (
                  <div
                    key={key}
                    className="grid grid-cols-[minmax(0,120px)_1fr] gap-3 rounded-2xl border border-border/50 bg-surface px-3 py-2 text-sm"
                  >
                    <span className="font-medium capitalize text-charcoal">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="break-words text-charcoal-light">{String(value)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-border/60 bg-background/85 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="block text-xs font-medium uppercase tracking-[0.22em] text-muted">
              Connections
            </span>
            <span className="text-xs text-muted">{connections.length} visible</span>
          </div>
          {connections.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No connected nodes are visible in the current graph view yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {connections.slice(0, 12).map(({ node, relationship }, index) => (
                <button
                  key={`${node.id}-${relationship}-${index}`}
                  onClick={() => setSelectedNode(node)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-surface px-3 py-2 text-left transition-all hover:-translate-y-px hover:border-charcoal/15 hover:bg-background"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entityColors[node.type] || '#8B919A' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-charcoal">{node.name}</p>
                    <p className="truncate text-xs text-muted-light">
                      {relationship.replace(/_/g, ' ').toLowerCase()}
                    </p>
                  </div>
                </button>
              ))}
              {connections.length > 12 && (
                <p className="px-1 text-xs text-muted">
                  +{connections.length - 12} more connections are available as the graph expands.
                </p>
              )}
            </div>
          )}
        </div>

        {selectedNode.documentIds.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border/60 bg-background/85 p-4 shadow-sm">
            <span className="block text-xs font-medium uppercase tracking-[0.22em] text-muted">
              Source documents
            </span>
            <div className="mt-3 space-y-2">
              {selectedNode.documentIds.slice(0, 5).map((docId) => (
                <div
                  key={docId}
                  className="flex items-center gap-2 rounded-2xl border border-border/50 bg-surface px-3 py-2 text-xs text-charcoal-light"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-light" />
                  <span className="truncate font-mono">{docId.slice(0, 18)}…</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border/50 px-5 py-4">
        <Button
          onClick={() => selectedNode && fetchNeighborhood(selectedNode.id)}
          loading={isLoading}
          className="w-full"
          size="sm"
        >
          <Expand className="h-3.5 w-3.5" />
          Expand neighborhood
        </Button>
        <p className="mt-2 text-xs leading-5 text-muted">
          Pull in additional hops around this entity without losing your current place in the graph.
        </p>
      </div>
    </div>
  );
}
