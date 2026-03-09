import { apiClient } from './client';
import type {
  User,
  AuthTokens,
  Document,
  Chunk,
  QueryRequest,
  QueryResult,
  QuerySource,
  GraphData,
  GraphNode,
  GraphEdge,
  LLMProvider,
  LLMModel,
  GraphToolConfig,
  PaginatedResponse,
} from '@/types';

type BackendPaginatedResponse<T> = {
  count: number;
  items?: T[];
  results?: T[];
  page: number;
  page_size: number;
  total_pages: number;
  next?: string | null;
  previous?: string | null;
};

type BackendDocument = {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  metadata?: Record<string, unknown>;
  chunk_count?: number;
  entity_count?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
};

type BackendChunk = {
  id: string;
  index: number;
  text: string;
  metadata?: Record<string, unknown>;
  neo4j_node_id?: string;
};

type BackendDocumentUpload = {
  document_id: string;
};

type BackendDocumentStats = {
  total_documents: number;
  status_breakdown: Record<string, number>;
};

type BackendDocumentStatus = {
  status: string;
  progress_pct: number;
  current_stage: string;
};

type BackendSource = {
  text: string;
  score?: number;
  source?: string;
  metadata?: Record<string, unknown>;
};

type BackendPipelineResult = {
  answer: string;
  sources: BackendSource[];
  latency_ms?: number;
  tool_metadata?: {
    graph_context?: QueryResult['graph_context'];
  };
  token_count?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type BackendQueryResult = {
  id: string;
  query: string;
  mode: string;
  provider: string;
  model: string;
  plain_result?: BackendPipelineResult | null;
  graph_result?: BackendPipelineResult | null;
  total_latency_ms: number;
  created_at: string;
};

type BackendProviderModel = {
  id: string;
  name: string;
  context_window?: number;
};

type BackendProvider = {
  name: string;
  display_name: string;
  configured: boolean;
  models: BackendProviderModel[];
};

type BackendGraphTool = {
  name: string;
  description: string;
};

type BackendGraphStats = {
  node_count: number;
  edge_count: number;
  entity_type_distribution: Array<{ type: string; count: number }>;
};

type BackendGraphNode = {
  id: string;
  name: string;
  type: string;
  description?: string;
  properties?: Record<string, unknown> | string | null;
};

type BackendGraphLink = {
  source: string;
  target: string;
  type: string;
  description?: string;
  weight?: number | null;
};

type BackendGraphPayload = {
  nodes: BackendGraphNode[];
  links: BackendGraphLink[];
};

function paginate<TInput, TOutput>(
  response: BackendPaginatedResponse<TInput>,
  mapItem: (item: TInput) => TOutput,
): PaginatedResponse<TOutput> {
  const items = response.results ?? response.items ?? [];
  return {
    results: items.map(mapItem),
    count: response.count,
    page: response.page,
    page_size: response.page_size,
    total_pages: response.total_pages,
    next: response.next ?? null,
    previous: response.previous ?? null,
  };
}

function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function mapDocument(document: BackendDocument): Document {
  const metadata = asRecord(document.metadata);
  return {
    id: document.id,
    title: typeof metadata.title === 'string' ? metadata.title : titleFromFilename(document.filename),
    filename: document.filename,
    file_type: document.file_type,
    file_size: document.file_size,
    status: document.status as Document['status'],
    page_count: asNumber(metadata.page_count),
    chunk_count: document.chunk_count,
    entity_count: document.entity_count,
    uploaded_by: typeof metadata.uploaded_by === 'string' ? metadata.uploaded_by : '',
    created_at: document.created_at,
    updated_at: document.updated_at,
    error_message: document.error_message || undefined,
  };
}

function mapChunk(documentId: string, chunk: BackendChunk): Chunk {
  const metadata = asRecord(chunk.metadata);
  return {
    id: chunk.id,
    document_id: documentId,
    content: chunk.text,
    chunk_index: chunk.index,
    page_number: asNumber(metadata.page_number),
    token_count: asNumber(metadata.token_count) ?? 0,
    embedding_generated: Boolean(chunk.neo4j_node_id),
    metadata,
  };
}

function mapSource(source: BackendSource): QuerySource {
  const metadata = asRecord(source.metadata);
  const documentId =
    typeof metadata.document_id === 'string' ? metadata.document_id : '';

  return {
    document_id: documentId,
    document_title:
      typeof metadata.document_title === 'string'
        ? metadata.document_title
        : source.source || documentId || 'Unknown source',
    chunk_id: typeof metadata.chunk_id === 'string' ? metadata.chunk_id : '',
    content: source.text,
    relevance_score: source.score ?? 0,
    page_number: asNumber(metadata.page_number),
  };
}

function mapQueryResult(result: BackendQueryResult): QueryResult {
  const plain = result.plain_result ?? null;
  const graph = result.graph_result ?? null;
  const mode: QueryResult['mode'] = result.mode === 'graph' ? 'graph' : 'plain';
  const primary = mode === 'graph' ? (graph ?? plain) : (plain ?? graph);
  const primarySources =
    mode === 'graph'
      ? (graph?.sources ?? plain?.sources ?? [])
      : (plain?.sources ?? graph?.sources ?? []);
  const graphContext =
    mode === 'graph' && graph?.tool_metadata?.graph_context
      ? graph.tool_metadata.graph_context
      : undefined;

  return {
    id: result.id,
    query: result.query,
    mode,
    answer: primary?.answer || '',
    sources: primarySources.map(mapSource),
    graph_context: graphContext,
    provider: result.provider,
    model: result.model,
    token_usage: primary?.token_count
      ? {
          prompt_tokens: primary.token_count.prompt_tokens ?? 0,
          completion_tokens: primary.token_count.completion_tokens ?? 0,
          total_tokens: primary.token_count.total_tokens ?? 0,
        }
      : undefined,
    latency_ms: primary?.latency_ms ?? result.total_latency_ms,
    created_at: result.created_at,
  };
}

function mapProvider(provider: BackendProvider): LLMProvider {
  return {
    id: provider.name,
    name: provider.display_name,
    provider_type: provider.name,
    is_configured: provider.configured,
    models: provider.models.map((model) => ({
      id: `${provider.name}:${model.id}`,
      name: model.name,
      provider_id: provider.name,
      model_id: model.id,
      context_window: model.context_window ?? 0,
      supports_streaming: true,
    })),
  };
}

function mapTool(tool: BackendGraphTool): GraphToolConfig {
  return {
    id: tool.name,
    name: tool.name.replace(/_/g, ' '),
    description: tool.description,
    tool_type: tool.name,
    is_configured: true,
  };
}

function mapGraphNode(node: BackendGraphNode): GraphNode {
  const properties = asRecord(node.properties);
  if (node.description && !properties.description) {
    properties.description = node.description;
  }

  return {
    id: node.id,
    label: node.name,
    entity_type: node.type as GraphNode['entity_type'],
    properties,
    document_ids: Array.isArray(properties.source_document_ids)
      ? properties.source_document_ids.filter(
          (value): value is string => typeof value === 'string',
        )
      : undefined,
  };
}

function mapGraphEdge(link: BackendGraphLink): GraphEdge {
  return {
    id: `${link.source}:${link.type}:${link.target}`,
    source: link.source,
    target: link.target,
    relationship_type: link.type,
    weight: link.weight ?? 1,
    properties: link.description ? { description: link.description } : {},
  };
}

function mapGraphData(payload: BackendGraphPayload): GraphData {
  return {
    nodes: payload.nodes.map(mapGraphNode),
    edges: payload.links.map(mapGraphEdge),
  };
}

function toQueryPayload(request: QueryRequest) {
  return {
    query: request.query,
    mode: request.mode,
    provider: request.provider,
    model: request.model,
    graph_tool: request.graph_tool,
    document_ids: request.document_ids,
    top_k: request.max_sources,
  };
}

// ──────────────────────────────────────────────
// Auth
// ──────────────────────────────────────────────

export const auth = {
  login: (email: string, password: string) =>
    apiClient.post<AuthTokens>('/auth/login', { email, password }),

  register: (data: { full_name: string; email: string; password: string; organization?: string }) =>
    apiClient.post<AuthTokens>('/auth/register', data),

  refresh: (refreshToken: string) =>
    apiClient.post<AuthTokens>('/auth/refresh', { refresh: refreshToken }),

  getMe: async () => {
    const user = await apiClient.get<Partial<User>>('/auth/me');
    return {
      id: String(user.id || ''),
      email: user.email || '',
      full_name: user.full_name || '',
      organization: user.organization,
      is_active: true,
      created_at: '',
    } satisfies User;
  },
};

// ──────────────────────────────────────────────
// Documents
// ──────────────────────────────────────────────

export const documents = {
  list: async (params?: { page?: number; page_size?: number; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString();
    const response = await apiClient.get<BackendPaginatedResponse<BackendDocument>>(
      `/documents${query ? `?${query}` : ''}`,
    );
    return paginate(response, mapDocument);
  },

  get: async (id: string) =>
    mapDocument(await apiClient.get<BackendDocument>(`/documents/${id}`)),

  upload: async (file: File, metadata?: Record<string, string>) => {
    const response = await apiClient.upload<BackendDocumentUpload>(
      '/documents/upload',
      file,
      'file',
      metadata,
    );
    return documents.get(response.document_id);
  },

  delete: (id: string) =>
    apiClient.delete<void>(`/documents/${id}`),

  getChunks: async (id: string, params?: { page?: number; page_size?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const query = searchParams.toString();
    const response = await apiClient.get<BackendPaginatedResponse<BackendChunk>>(
      `/documents/${id}/chunks${query ? `?${query}` : ''}`,
    );
    return paginate(response, (chunk) => mapChunk(id, chunk));
  },

  getStatus: async (id: string) => {
    const status = await apiClient.get<BackendDocumentStatus>(`/documents/${id}/status`);
    return {
      status: status.status,
      progress: status.progress_pct,
      stage: status.current_stage,
    };
  },

  getStats: async () => {
    const stats = await apiClient.get<BackendDocumentStats>('/documents/stats');
    const processing = Object.entries(stats.status_breakdown || {}).reduce(
      (total, [status, count]) =>
        status === 'completed' || status === 'failed' ? total : total + count,
      0,
    );

    return {
      total: stats.total_documents,
      processing,
      completed: stats.status_breakdown?.completed ?? 0,
      failed: stats.status_breakdown?.failed ?? 0,
    };
  },
};

// ──────────────────────────────────────────────
// Query
// ──────────────────────────────────────────────

export const query = {
  execute: async (request: QueryRequest) =>
    mapQueryResult(
      await apiClient.post<BackendQueryResult>('/query', toQueryPayload(request)),
    ),

  stream: (request: QueryRequest, options?: { signal?: AbortSignal }) =>
    apiClient.stream('/query/stream', toQueryPayload(request), options),

  getHistory: async (params?: { page?: number; page_size?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const queryString = searchParams.toString();
    const response = await apiClient.get<BackendPaginatedResponse<{ id: string }>>(
      `/query/history${queryString ? `?${queryString}` : ''}`,
    );
    const ids = response.results ?? response.items ?? [];
    const results = await Promise.all(
      ids.map(async ({ id }) =>
        mapQueryResult(await apiClient.get<BackendQueryResult>(`/query/history/${id}`)),
      ),
    );

    return {
      ...paginate(response, ({ id }) => id),
      results,
    };
  },
};

// ──────────────────────────────────────────────
// Graph
// ──────────────────────────────────────────────

export const graph = {
  getStats: async () => {
    const stats = await apiClient.get<BackendGraphStats>('/graph/stats');
    return {
      nodes: stats.node_count,
      edges: stats.edge_count,
      entity_types: Object.fromEntries(
        stats.entity_type_distribution.map((item) => [item.type, item.count]),
      ),
    };
  },

  getVisualize: async (params?: { limit?: number; entity_types?: string[] }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.entity_types) {
      searchParams.set('document_ids', params.entity_types.join(','));
    }
    const queryString = searchParams.toString();
    const response = await apiClient.get<BackendGraphPayload>(
      `/graph/visualize${queryString ? `?${queryString}` : ''}`,
    );
    return mapGraphData(response);
  },

  searchEntities: async (queryText: string, params?: { entity_type?: string; limit?: number }) => {
    const searchParams = new URLSearchParams({ query: queryText });
    if (params?.entity_type) searchParams.set('type', params.entity_type);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const response = await apiClient.get<BackendGraphNode[]>(
      `/graph/entities?${searchParams.toString()}`,
    );
    return response.map(mapGraphNode);
  },

  getNeighborhood: async (nodeId: string, depth = 1) => {
    const response = await apiClient.get<BackendGraphPayload>(
      `/graph/entities/${nodeId}/neighborhood?depth=${depth}`,
    );
    return mapGraphData(response);
  },
};

// ──────────────────────────────────────────────
// Settings
// ──────────────────────────────────────────────

export const settings = {
  getProviders: async () => {
    const providers = await apiClient.get<BackendProvider[]>('/settings/llm-providers');
    return providers.map(mapProvider);
  },

  getTools: async () => {
    const tools = await apiClient.get<BackendGraphTool[]>('/settings/graph-tools');
    return tools.map(mapTool);
  },

  getPreferences: async () => ({}),

  updatePreferences: async (prefs: Record<string, unknown>) => prefs,

  getModels: async (providerId: string) => {
    const providers = await settings.getProviders();
    return providers.find((provider) => provider.id === providerId)?.models ?? [];
  },
};
