'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useGraphStore, buildForceGraphData, type ForceNode } from '@/stores/graph';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  ),
});

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  ),
});

/* eslint-disable @typescript-eslint/no-explicit-any */

interface GraphCanvasProps {
  className?: string;
}

export interface GraphCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
  focusNode: (nodeId: string) => void;
}

export const GraphCanvas = React.forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas(
  { className },
  ref,
) {
  const graphData = useGraphStore((state) => state.graphData);
  const selectedTypes = useGraphStore((state) => state.selectedTypes);
  const selectedNode = useGraphStore((state) => state.selectedNode);
  const is3D = useGraphStore((state) => state.is3D);
  const isLoading = useGraphStore((state) => state.isLoading);
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode);
  const fetchNeighborhood = useGraphStore((state) => state.fetchNeighborhood);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const graphRef = React.useRef<any>(null);
  const pinnedNodeRef = React.useRef<ForceNode | null>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });
  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null);

  const forceGraphData = React.useMemo(
    () => buildForceGraphData(graphData, selectedTypes),
    [graphData, selectedTypes],
  );

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: Math.max(width, 100), height: Math.max(height, 100) });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const releasePinnedNode = React.useCallback(() => {
    if (!pinnedNodeRef.current) return;

    pinnedNodeRef.current.fx = undefined;
    pinnedNodeRef.current.fy = undefined;
    pinnedNodeRef.current.fz = undefined;
    pinnedNodeRef.current = null;
  }, []);

  const focusNode = React.useCallback(
    (nodeId: string) => {
      const node = forceGraphData?.nodes.find((candidate) => candidate.id === nodeId);
      if (!node || !graphRef.current) return;

      releasePinnedNode();
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        node.fx = node.x;
        node.fy = node.y;
        if (is3D && typeof node.z === 'number') {
          node.fz = node.z;
        }
        pinnedNodeRef.current = node;
      }

      if (is3D) {
        const distance = 150;
        const safeX = node.x || 0;
        const safeY = node.y || 0;
        const safeZ = node.z || 0;
        const distRatio = 1 + distance / Math.max(Math.hypot(safeX, safeY, safeZ), 1);
        graphRef.current.cameraPosition(
          {
            x: safeX * distRatio,
            y: safeY * distRatio,
            z: safeZ * distRatio,
          },
          node,
          900,
        );
        return;
      }

      graphRef.current.centerAt(node.x || 0, node.y || 0, 450);
      graphRef.current.zoom(2.2, 450);
    },
    [forceGraphData, is3D, releasePinnedNode],
  );

  const fitView = React.useCallback(() => {
    if (!graphRef.current || !forceGraphData?.nodes.length) return;
    graphRef.current.zoomToFit?.(600, 80);
  }, [forceGraphData?.nodes.length]);

  const zoomIn = React.useCallback(() => {
    if (!graphRef.current) return;

    if (is3D) {
      const camera = graphRef.current.camera?.();
      if (!camera) return;
      graphRef.current.cameraPosition(
        {
          x: camera.position.x * 0.82,
          y: camera.position.y * 0.82,
          z: camera.position.z * 0.82,
        },
        undefined,
        250,
      );
      return;
    }

    const currentZoom = graphRef.current.zoom?.() || 1;
    graphRef.current.zoom?.(Math.min(currentZoom * 1.25, 8), 250);
  }, [is3D]);

  const zoomOut = React.useCallback(() => {
    if (!graphRef.current) return;

    if (is3D) {
      const camera = graphRef.current.camera?.();
      if (!camera) return;
      graphRef.current.cameraPosition(
        {
          x: camera.position.x * 1.22,
          y: camera.position.y * 1.22,
          z: camera.position.z * 1.22,
        },
        undefined,
        250,
      );
      return;
    }

    const currentZoom = graphRef.current.zoom?.() || 1;
    graphRef.current.zoom?.(Math.max(currentZoom / 1.25, 0.35), 250);
  }, [is3D]);

  React.useImperativeHandle(
    ref,
    () => ({
      zoomIn,
      zoomOut,
      fitView,
      focusNode,
    }),
    [fitView, focusNode, zoomIn, zoomOut],
  );

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (graphRef.current && forceGraphData && forceGraphData.nodes.length > 0) {
        if (!is3D) {
          graphRef.current.d3Force?.('charge')?.strength?.(-210);
          graphRef.current.d3Force?.('link')?.distance?.(110);
          graphRef.current.d3Force?.('link')?.strength?.(0.18);
          graphRef.current.d3VelocityDecay?.(0.38);
        }
        fitView();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [fitView, forceGraphData?.nodes.length, is3D]);

  React.useEffect(() => {
    if (!selectedNode?.id) {
      releasePinnedNode();
      return;
    }

    const timer = window.setTimeout(() => focusNode(selectedNode.id), 75);
    return () => window.clearTimeout(timer);
  }, [focusNode, forceGraphData?.nodes.length, releasePinnedNode, selectedNode?.id]);

  React.useEffect(() => () => releasePinnedNode(), [releasePinnedNode]);

  const handleNodeClick = React.useCallback(
    (node: any) => {
      setSelectedNode(node as ForceNode);
      focusNode(node.id);
    },
    [focusNode, setSelectedNode],
  );

  const handleNodeHover = React.useCallback(
    (node: any, _prev?: any) => {
      setHoveredNodeId(node?.id ?? null);
    },
    [],
  );

  const handleNodeRightClick = React.useCallback(
    (node: any) => {
      setSelectedNode(node as ForceNode);
      fetchNeighborhood(node.id);
    },
    [setSelectedNode, fetchNeighborhood],
  );

  // Custom 2D node rendering
  const nodeCanvasObject = React.useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name || '';
      const fontSize = Math.max(12 / globalScale, 1.5);
      const nodeRadius = Math.max(Math.sqrt(node.val || 2) * 3, 4);
      const x = node.x || 0;
      const y = node.y || 0;

      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNodeId === node.id;

      // Glow for selected/hovered
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius + 4, 0, 2 * Math.PI);
        ctx.fillStyle = isSelected
          ? `${node.color}40`
          : `${node.color}25`;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = node.color || '#6C757D';
      ctx.fill();

      // White border
      ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = isSelected ? 2 / globalScale : 1 / globalScale;
      ctx.stroke();

      // Label (only show when zoomed in enough)
      if (globalScale > 0.9) {
        ctx.font = `${isSelected ? '600 ' : ''}${fontSize}px Geist, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Text background
        const textWidth = ctx.measureText(label).width;
        const padding = 2 / globalScale;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(
          x - textWidth / 2 - padding,
          y + nodeRadius + 2 / globalScale,
          textWidth + padding * 2,
          fontSize + padding,
        );

        // Text
        ctx.fillStyle = '#2D2D2D';
        ctx.fillText(label, x, y + nodeRadius + 3 / globalScale);
      }
    },
    [hoveredNodeId, selectedNode?.id],
  );

  const nodePointerAreaPaint = React.useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      const nodeRadius = Math.max(Math.sqrt(node.val || 2) * 3, 4);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, nodeRadius + 4, 0, 2 * Math.PI);
      ctx.fill();
    },
    [],
  );

  // Link rendering
  const linkColor = React.useCallback(() => 'rgba(222,226,230,0.6)', []);
  const linkLabel = React.useCallback((link: any) => link.type || '', []);

  if (isLoading && !forceGraphData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-muted">Loading graph data...</p>
        </div>
      </div>
    );
  }

  if (!forceGraphData || forceGraphData.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-light">
            <svg className="h-8 w-8 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-charcoal">No graph data yet</h3>
          <p className="max-w-sm text-sm text-muted">
            Upload and process documents to build the knowledge graph. Entities and relationships will appear here.
          </p>
        </div>
      </div>
    );
  }

  const sharedProps = {
    ref: graphRef,
    graphData: { nodes: forceGraphData.nodes, links: forceGraphData.links },
    width: dimensions.width,
    height: dimensions.height,
    backgroundColor: '#F8F9FA',
    onNodeClick: handleNodeClick,
    onNodeRightClick: handleNodeRightClick,
    onNodeHover: handleNodeHover,
    linkColor: linkColor,
    nodeLabel: (node: any) => `${node.name} (${node.type})`,
    linkDirectionalArrowLength: is3D ? 4 : 0,
    linkDirectionalArrowRelPos: 0.85,
    linkDirectionalArrowColor: linkColor,
    linkLabel: linkLabel,
    linkWidth: 1,
    enableNodeDrag: false,
    enableZoomInteraction: true,
    enablePanInteraction: true,
    cooldownTicks: is3D ? 120 : 60,
    warmupTicks: is3D ? 30 : 10,
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,#ffffff_0%,#f8fafc_45%,#eef2f6_100%)]',
        className,
      )}
    >
      {is3D ? (
        <ForceGraph3D
          {...sharedProps}
          nodeColor={(node: any) => node.color}
          nodeRelSize={5}
          nodeVal={(node: any) => node.val}
        />
      ) : (
        <ForceGraph2D
          {...sharedProps}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={nodePointerAreaPaint}
        />
      )}

      {/* Loading overlay */}
      {isLoading && forceGraphData && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface px-4 py-2 shadow-lg">
            <Spinner size="sm" />
            <span className="text-sm text-muted">Expanding...</span>
          </div>
        </div>
      )}
    </div>
  );
});
