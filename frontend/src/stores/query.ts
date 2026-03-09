import { create } from 'zustand';
import type {
  GraphContext,
  LLMProvider,
  QueryMode,
  QueryResult,
  QuerySource,
} from '@/types';
import { query as queryApi, settings as settingsApi } from '@/lib/api/endpoints';

type BackendStreamSource = {
  text: string;
  score?: number;
  source?: string;
  metadata?: Record<string, unknown>;
};

type StreamToolMetadata = {
  graph_context?: GraphContext;
};

function mapStreamSource(source: BackendStreamSource): QuerySource {
  const metadata =
    source.metadata && typeof source.metadata === 'object' ? source.metadata : {};

  return {
    document_id:
      typeof metadata.document_id === 'string' ? metadata.document_id : '',
    document_title:
      typeof metadata.document_title === 'string'
        ? metadata.document_title
        : source.source || 'Unknown source',
    chunk_id: typeof metadata.chunk_id === 'string' ? metadata.chunk_id : '',
    content: source.text,
    relevance_score: source.score ?? 0,
    page_number:
      typeof metadata.page_number === 'number' ? metadata.page_number : undefined,
  };
}

function getGraphContext(value: unknown): GraphContext | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as GraphContext;
  if (!Array.isArray(candidate.entities) || !Array.isArray(candidate.relationships)) {
    return undefined;
  }
  return candidate;
}

interface QueryState {
  mode: QueryMode;
  provider: string;
  model: string;

  currentQuery: string;
  isLoading: boolean;
  isStreaming: boolean;
  streamedText: string;

  plainResult: QueryResult | null;
  graphResult: QueryResult | null;

  availableProviders: LLMProvider[];

  history: QueryResult[];
  isHistoryLoading: boolean;
  historyPage: number;
  historyTotalPages: number;

  error: string | null;
  _abortController: AbortController | null;

  setMode: (mode: QueryMode) => void;
  setProvider: (provider: string) => void;
  setModel: (model: string) => void;
  setCurrentQuery: (query: string) => void;
  executeQuery: (query: string, documentIds?: string[]) => Promise<void>;
  streamQuery: (query: string, documentIds?: string[]) => Promise<void>;
  fetchProviders: () => Promise<void>;
  fetchHistory: (page?: number) => Promise<void>;
  cancelStream: () => void;
  clearError: () => void;
  clearResults: () => void;
}

export const useQueryStore = create<QueryState>((set, get) => ({
  mode: 'plain',
  provider: '',
  model: '',

  currentQuery: '',
  isLoading: false,
  isStreaming: false,
  streamedText: '',

  plainResult: null,
  graphResult: null,

  availableProviders: [],

  history: [],
  isHistoryLoading: false,
  historyPage: 1,
  historyTotalPages: 1,

  error: null,
  _abortController: null,

  setMode: (mode) => set({ mode }),
  setProvider: (provider) => set({ provider }),
  setModel: (model) => set({ model }),
  setCurrentQuery: (query) => set({ currentQuery: query }),
  clearError: () => set({ error: null }),
  clearResults: () =>
    set({
      plainResult: null,
      graphResult: null,
      streamedText: '',
      error: null,
    }),

  executeQuery: async (queryText: string, documentIds?: string[]) => {
    const { mode, provider, model } = get();
    set({
      isLoading: true,
      error: null,
      currentQuery: queryText,
      plainResult: null,
      graphResult: null,
      streamedText: '',
    });

    try {
      const result = await queryApi.execute({
        query: queryText,
        mode,
        provider: provider || undefined,
        model: model || undefined,
        document_ids: documentIds,
      });

      if (mode === 'plain') {
        set({ plainResult: result, isLoading: false });
      } else {
        set({ graphResult: result, isLoading: false });
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Query failed',
        isLoading: false,
      });
    }
  },

  streamQuery: async (queryText: string, documentIds?: string[]) => {
    const { mode, provider, model } = get();
    const abortController = new AbortController();

    set({
      isStreaming: true,
      streamedText: '',
      error: null,
      currentQuery: queryText,
      plainResult: null,
      graphResult: null,
      _abortController: abortController,
    });

    try {
      const stream = queryApi.stream(
        {
          query: queryText,
          mode,
          provider: provider || undefined,
          model: model || undefined,
          document_ids: documentIds,
        },
        { signal: abortController.signal },
      );

      let buffer = '';
      let fullContent = '';
      let finalResult: QueryResult | null = null;
      let streamedSources: QuerySource[] = [];
      let streamedGraphContext: GraphContext | undefined;
      let latencyMs = 0;

      for await (const rawChunk of stream) {
        buffer += rawChunk;
        const lines = buffer.split('\n');
        buffer = '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
              const parsed: {
                type?: string;
                content?: string;
                data?: unknown;
                sources?: BackendStreamSource[];
                latency_ms?: number;
                message?: string;
                tool_metadata?: StreamToolMetadata;
              } = JSON.parse(jsonStr);

              if (parsed.type === 'chunk' && parsed.content) {
                fullContent += parsed.content;
                set({ streamedText: fullContent });
              } else if (!parsed.type && parsed.content) {
                fullContent += parsed.content;
                set({ streamedText: fullContent });
              } else if (parsed.type === 'sources' && parsed.sources) {
                streamedSources = parsed.sources.map(mapStreamSource);
              } else if (parsed.type === 'tool_metadata') {
                streamedGraphContext = getGraphContext(parsed.tool_metadata?.graph_context);
              } else if (
                parsed.type === 'metadata' &&
                typeof parsed.latency_ms === 'number'
              ) {
                latencyMs = parsed.latency_ms;
              } else if (parsed.type === 'done' && parsed.data) {
                finalResult = parsed.data as QueryResult;
              } else if (parsed.type === 'error') {
                set({
                  error: parsed.content || parsed.message || 'Stream error',
                  isStreaming: false,
                  _abortController: null,
                });
                return;
              }
            } catch {
              if (i === lines.length - 1) {
                buffer = line;
              }
            }
          } else if (line.trim()) {
            fullContent += line;
            set({ streamedText: fullContent });
          }
        }
      }

      if (finalResult) {
        const resultWithGraphContext =
          mode === 'graph' && streamedGraphContext && !finalResult.graph_context
            ? { ...finalResult, graph_context: streamedGraphContext }
            : finalResult;

        if (mode === 'plain') {
          set({ plainResult: resultWithGraphContext });
        } else {
          set({ graphResult: resultWithGraphContext });
        }
      } else if (fullContent) {
        const syntheticResult: QueryResult = {
          id: crypto.randomUUID(),
          query: queryText,
          mode,
          answer: fullContent,
          sources: streamedSources,
          graph_context: mode === 'graph' ? streamedGraphContext : undefined,
          provider: provider || 'default',
          model: model || 'default',
          latency_ms: latencyMs,
          created_at: new Date().toISOString(),
        };
        if (mode === 'plain') {
          set({ plainResult: syntheticResult });
        } else {
          set({ graphResult: syntheticResult });
        }
      }

      set({ isStreaming: false, _abortController: null });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        set({ isStreaming: false, _abortController: null });
        return;
      }
      set({
        error: err instanceof Error ? err.message : 'Stream failed',
        isStreaming: false,
        _abortController: null,
      });
    }
  },

  cancelStream: () => {
    const { _abortController } = get();
    if (_abortController) {
      _abortController.abort();
      set({ isStreaming: false, _abortController: null });
    }
  },

  fetchProviders: async () => {
    try {
      const providers = await settingsApi.getProviders();
      set({ availableProviders: providers });

      const { provider, model } = get();
      if (!provider) {
        const configured = providers.find((item) => item.is_configured);
        if (configured) {
          set({
            provider: configured.id,
            model: configured.models[0]?.model_id || '',
          });
        }
        return;
      }

      const selectedProvider = providers.find((item) => item.id === provider);
      if (!selectedProvider) {
        const configured = providers.find((item) => item.is_configured);
        set({
          provider: configured?.id || '',
          model: configured?.models[0]?.model_id || '',
        });
        return;
      }

      const hasSelectedModel = selectedProvider.models.some(
        (item) => item.model_id === model,
      );
      if (!hasSelectedModel) {
        set({ model: selectedProvider.models[0]?.model_id || '' });
      }
    } catch {
      // Settings are optional in the demo flow.
    }
  },

  fetchHistory: async (page = 1) => {
    set({ isHistoryLoading: true });
    try {
      const response = await queryApi.getHistory({ page, page_size: 20 });
      set({
        history: response.results,
        historyPage: response.page,
        historyTotalPages: response.total_pages,
        isHistoryLoading: false,
      });
    } catch {
      set({ isHistoryLoading: false });
    }
  },
}));
