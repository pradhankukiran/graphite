// ──────────────────────────────────────────────
// Auth
// ──────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string;
  organization?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  user?: User;
}

// ──────────────────────────────────────────────
// Documents
// ──────────────────────────────────────────────

export interface Document {
  id: string;
  title: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  page_count?: number;
  chunk_count?: number;
  entity_count?: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  error_message?: string;
}

export interface Chunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  page_number?: number;
  token_count: number;
  embedding_generated: boolean;
  metadata?: Record<string, unknown>;
}

export interface IngestionJob {
  id: string;
  document_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stage: string;
  progress: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export interface IngestionProgress {
  stage: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
}

// ──────────────────────────────────────────────
// Query
// ──────────────────────────────────────────────

export type QueryMode = 'plain' | 'graph';

export interface QueryRequest {
  query: string;
  mode: QueryMode;
  provider?: string;
  model?: string;
  graph_tool?: string;
  document_ids?: string[];
  max_sources?: number;
}

export interface QueryResult {
  id: string;
  query: string;
  mode: QueryMode;
  answer: string;
  sources: QuerySource[];
  graph_context?: GraphContext;
  provider: string;
  model: string;
  token_usage?: TokenUsage;
  latency_ms: number;
  created_at: string;
}

export interface QuerySource {
  document_id: string;
  document_title: string;
  chunk_id: string;
  content: string;
  relevance_score: number;
  page_number?: number;
}

export interface GraphContext {
  entities: GraphNode[];
  relationships: GraphEdge[];
  subgraph_summary?: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface StreamChunk {
  type: 'chunk' | 'source' | 'graph_data' | 'done' | 'error';
  content?: string;
  data?: unknown;
}

// ──────────────────────────────────────────────
// Graph
// ──────────────────────────────────────────────

export type EntityType = 'Person' | 'Organization' | 'Location' | 'Concept' | 'Event' | 'Technology';

export interface GraphNode {
  id: string;
  label: string;
  entity_type: EntityType;
  properties?: Record<string, unknown>;
  document_ids?: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship_type: string;
  weight?: number;
  properties?: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ──────────────────────────────────────────────
// Settings
// ──────────────────────────────────────────────

export interface LLMProvider {
  id: string;
  name: string;
  provider_type: string;
  is_configured: boolean;
  models: LLMModel[];
}

export interface LLMModel {
  id: string;
  name: string;
  provider_id: string;
  model_id: string;
  context_window: number;
  supports_streaming: boolean;
}

export interface GraphToolConfig {
  id: string;
  name: string;
  description: string;
  tool_type: string;
  is_configured: boolean;
  config?: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// API
// ──────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  next?: string | null;
  previous?: string | null;
}
