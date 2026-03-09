import { create } from 'zustand';
import type { GraphData, GraphNode, EntityType } from '@/types';
import { graph as graphApi } from '@/lib/api/endpoints';
import { entityColors } from '@/styles/theme';

interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  entityTypes: Record<string, number>;
}

/** Shape expected by react-force-graph */
export interface ForceNode {
  id: string;
  name: string;
  type: EntityType;
  val: number;
  color: string;
  description: string;
  properties: Record<string, unknown>;
  documentIds: string[];
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}

export interface ForceLink {
  source: string;
  target: string;
  type: string;
  description: string;
  weight: number;
}

export interface ForceGraphData {
  nodes: ForceNode[];
  links: ForceLink[];
}

interface GraphStore {
  // Data
  graphData: GraphData | null;
  selectedNode: ForceNode | null;
  neighborhoodData: GraphData | null;
  stats: GraphStats | null;

  // UI State
  is3D: boolean;
  isLoading: boolean;
  searchQuery: string;
  selectedTypes: string[];
  depth: number;

  // Actions
  fetchGraphData: (documentIds?: string[]) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchNeighborhood: (entityId: string) => Promise<void>;
  searchEntities: (query: string) => Promise<GraphNode[]>;
  setSelectedNode: (node: ForceNode | null) => void;
  toggle3D: () => void;
  setSearchQuery: (query: string) => void;
  setSelectedTypes: (types: string[]) => void;
  setDepth: (depth: number) => void;
  getFilteredData: () => ForceGraphData | null;
  getConnectedNodes: (nodeId: string) => { node: ForceNode; relationship: string }[];
}

function toForceGraphData(data: GraphData): ForceGraphData {
  // Build adjacency count for sizing
  const connectionCount: Record<string, number> = {};
  for (const edge of data.edges) {
    connectionCount[edge.source] = (connectionCount[edge.source] || 0) + 1;
    connectionCount[edge.target] = (connectionCount[edge.target] || 0) + 1;
  }

  const nodes: ForceNode[] = data.nodes.map((n) => ({
    id: n.id,
    name: n.label,
    type: n.entity_type,
    val: Math.max(2, (connectionCount[n.id] || 0) + 1),
    color: entityColors[n.entity_type] || '#6C757D',
    description: (n.properties?.description as string) || '',
    properties: n.properties || {},
    documentIds: n.document_ids || [],
  }));

  const nodeIds = new Set(data.nodes.map((n) => n.id));
  const links: ForceLink[] = data.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      type: e.relationship_type,
      description: (e.properties?.description as string) || e.relationship_type,
      weight: e.weight || 1,
    }));

  return { nodes, links };
}

export function buildForceGraphData(
  data: GraphData | null,
  selectedTypes: string[],
): ForceGraphData | null {
  if (!data) return null;

  const forceData = toForceGraphData(data);
  if (selectedTypes.length === 0) return forceData;

  const filteredNodes = forceData.nodes.filter((node) =>
    selectedTypes.includes(node.type),
  );
  const filteredNodeIds = new Set(filteredNodes.map((node) => node.id));
  const filteredLinks = forceData.links.filter(
    (link) => filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target),
  );

  return { nodes: filteredNodes, links: filteredLinks };
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  // Data
  graphData: null,
  selectedNode: null,
  neighborhoodData: null,
  stats: null,

  // UI State
  is3D: false,
  isLoading: false,
  searchQuery: '',
  selectedTypes: [],
  depth: 1,

  // Actions
  fetchGraphData: async (documentIds?: string[]) => {
    set({ isLoading: true });
    try {
      const data = await graphApi.getVisualize({
        limit: 500,
        entity_types: documentIds, // backend accepts filtering
      });
      set({ graphData: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const raw = await graphApi.getStats();
      set({
        stats: {
          nodeCount: raw.nodes,
          edgeCount: raw.edges,
          entityTypes: raw.entity_types,
        },
      });
    } catch {
      // silently fail
    }
  },

  fetchNeighborhood: async (entityId: string) => {
    const { depth } = get();
    set({ isLoading: true });
    try {
      const data = await graphApi.getNeighborhood(entityId, depth);
      // Merge neighborhood into existing graph data
      const existing = get().graphData;
      if (existing) {
        const existingNodeIds = new Set(existing.nodes.map((n) => n.id));
        const existingEdgeIds = new Set(existing.edges.map((e) => e.id));

        const merged: GraphData = {
          nodes: [
            ...existing.nodes,
            ...data.nodes.filter((n) => !existingNodeIds.has(n.id)),
          ],
          edges: [
            ...existing.edges,
            ...data.edges.filter((e) => !existingEdgeIds.has(e.id)),
          ],
        };
        set({ graphData: merged, neighborhoodData: data, isLoading: false });
      } else {
        set({ graphData: data, neighborhoodData: data, isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  searchEntities: async (query: string) => {
    try {
      return await graphApi.searchEntities(query, { limit: 10 });
    } catch {
      return [];
    }
  },

  setSelectedNode: (node) => set({ selectedNode: node }),

  toggle3D: () => set((state) => ({ is3D: !state.is3D })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSelectedTypes: (types) => set({ selectedTypes: types }),

  setDepth: (depth) => set({ depth: Math.min(3, Math.max(1, depth)) }),

  getFilteredData: () => {
    const { graphData, selectedTypes } = get();
    return buildForceGraphData(graphData, selectedTypes);
  },

  getConnectedNodes: (nodeId: string) => {
    const { graphData, selectedTypes } = get();
    const data = buildForceGraphData(graphData, selectedTypes);
    if (!data) return [];

    const connections: { node: ForceNode; relationship: string }[] = [];
    const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));

    for (const link of data.links) {
      const sourceId = typeof link.source === 'object' ? (link.source as ForceNode).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as ForceNode).id : link.target;

      if (sourceId === nodeId) {
        const target = nodeMap.get(targetId);
        if (target) connections.push({ node: target, relationship: link.type });
      } else if (targetId === nodeId) {
        const source = nodeMap.get(sourceId);
        if (source) connections.push({ node: source, relationship: link.type });
      }
    }

    return connections;
  },
}));
