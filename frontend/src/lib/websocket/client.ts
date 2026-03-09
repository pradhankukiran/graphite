type EventHandler = (data: unknown) => void;

interface WebSocketManagerOptions {
  url: string;
  token?: string;
  reconnect?: boolean;
  maxRetries?: number;
  baseDelay?: number;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null;
  private reconnect: boolean;
  private maxRetries: number;
  private baseDelay: number;
  private retryCount = 0;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private isManuallyClosed = false;

  constructor(options: WebSocketManagerOptions) {
    this.url = options.url;
    this.token = options.token || null;
    this.reconnect = options.reconnect ?? true;
    this.maxRetries = options.maxRetries ?? 5;
    this.baseDelay = options.baseDelay ?? 1000;
  }

  connect(): void {
    this.isManuallyClosed = false;

    const wsUrl = this.token
      ? `${this.url}?token=${encodeURIComponent(this.token)}`
      : this.url;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.retryCount = 0;
      this.emit('connected', null);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const eventType = data.type || 'message';
        this.emit(eventType, data);
        this.emit('message', data);
      } catch {
        this.emit('message', event.data);
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.emit('disconnected', { code: event.code, reason: event.reason });

      if (!this.isManuallyClosed && this.reconnect && this.retryCount < this.maxRetries) {
        const delay = this.baseDelay * Math.pow(2, this.retryCount);
        this.retryCount++;
        this.emit('reconnecting', { attempt: this.retryCount, delay });
        setTimeout(() => this.connect(), delay);
      }
    };

    this.ws.onerror = () => {
      this.emit('error', { message: 'WebSocket error' });
    };
  }

  disconnect(): void {
    this.isManuallyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((handler) => handler(data));
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export function createWebSocketUrl(path: string): string {
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = process.env.NEXT_PUBLIC_WS_URL || window.location.host;
  return `${protocol}//${host}${path}`;
}
