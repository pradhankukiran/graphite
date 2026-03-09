'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketManager, createWebSocketUrl } from './client';
import { apiClient } from '@/lib/api/client';

export interface IngestionProgress {
  stage: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
}

export function useIngestionProgress(documentId: string | null) {
  const [state, setState] = useState<IngestionProgress>({
    stage: '',
    progress: 0,
    status: 'pending',
    message: '',
  });
  const wsRef = useRef<WebSocketManager | null>(null);

  useEffect(() => {
    if (!documentId) return;

    const token = apiClient.getToken();
    const url = createWebSocketUrl(`/ws/ingestion/${documentId}/`);

    const ws = new WebSocketManager({
      url,
      token: token || undefined,
    });

    ws.on('ingestion_progress', (data: unknown) => {
      const d = data as {
        stage?: string;
        progress?: number;
        status?: string;
        message?: string;
      };
      setState({
        stage: d.stage || '',
        progress: d.progress || 0,
        status: (d.status as IngestionProgress['status']) || 'processing',
        message: d.message || '',
      });
    });

    ws.on('ingestion_complete', () => {
      setState((prev) => ({
        ...prev,
        status: 'completed',
        progress: 100,
        message: 'Ingestion complete',
      }));
    });

    ws.on('ingestion_error', (data: unknown) => {
      const d = data as { message?: string };
      setState((prev) => ({
        ...prev,
        status: 'failed',
        message: d.message || 'Ingestion failed',
      }));
    });

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [documentId]);

  return state;
}

export interface StreamEvent {
  type: 'chunk' | 'source' | 'graph_data' | 'done' | 'error';
  content?: string;
  data?: unknown;
}

export function useQueryStream() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const wsRef = useRef<WebSocketManager | null>(null);

  const startStream = useCallback((queryData: unknown) => {
    const token = apiClient.getToken();
    const url = createWebSocketUrl('/ws/query/stream/');

    // Disconnect previous if any
    wsRef.current?.disconnect();

    const ws = new WebSocketManager({
      url,
      token: token || undefined,
      reconnect: false,
    });

    setEvents([]);
    setIsStreaming(true);

    ws.on('connected', () => {
      ws.send(queryData);
    });

    ws.on('message', (data: unknown) => {
      const event = data as StreamEvent;
      setEvents((prev) => [...prev, event]);

      if (event.type === 'done' || event.type === 'error') {
        setIsStreaming(false);
      }
    });

    ws.on('disconnected', () => {
      setIsStreaming(false);
    });

    ws.on('error', () => {
      setIsStreaming(false);
    });

    ws.connect();
    wsRef.current = ws;
  }, []);

  const stopStream = useCallback(() => {
    wsRef.current?.disconnect();
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.disconnect();
    };
  }, []);

  return { events, isStreaming, startStream, stopStream };
}
