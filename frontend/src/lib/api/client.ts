const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api')
  .replace(/\/api\/v1$/, '/api')
  .replace(/\/$/, '');

type RequestOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  }

  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('access_token', token);
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh_token');
  }

  setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('refresh_token', token);
  }

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  private getHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extra,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) {
      const refreshed = await this.tryRefreshToken();
      if (!refreshed) {
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Authentication expired');
      }
      throw new Error('TOKEN_REFRESHED');
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody.detail || errorBody.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  private async tryRefreshToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.setToken(data.access);
      if (data.refresh) {
        this.setRefreshToken(data.refresh);
      }
      return true;
    } catch {
      return false;
    }
  }

  private async requestWithRetry<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = this.getHeaders(options?.headers);

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: options?.signal,
    };

    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      return await this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof Error && error.message === 'TOKEN_REFRESHED') {
        // Retry with new token
        const retryHeaders = this.getHeaders(options?.headers);
        const retryResponse = await fetch(url, {
          ...fetchOptions,
          headers: retryHeaders,
        });
        return await this.handleResponse<T>(retryResponse);
      }
      throw error;
    }
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.requestWithRetry<T>('GET', path, undefined, options);
  }

  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.requestWithRetry<T>('POST', path, body, options);
  }

  async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.requestWithRetry<T>('PUT', path, body, options);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.requestWithRetry<T>('DELETE', path, undefined, options);
  }

  async upload<T>(path: string, file: File, fieldName = 'file', extraFields?: Record<string, string>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const formData = new FormData();
    formData.append(fieldName, file);

    if (extraFields) {
      for (const [key, value] of Object.entries(extraFields)) {
        formData.append(key, value);
      }
    }

    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Do NOT set Content-Type for FormData — browser sets it with boundary

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.getToken()}`;
        const retryResponse = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
        });
        return this.handleResponse<T>(retryResponse);
      }
      this.clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Authentication expired');
    }

    return this.handleResponse<T>(response);
  }

  async *stream(path: string, body?: unknown, options?: RequestOptions): AsyncGenerator<string> {
    const url = `${this.baseUrl}${path}`;
    const fetchStreamResponse = async () =>
      fetch(url, {
        method: 'POST',
        headers: this.getHeaders(options?.headers),
        body: body ? JSON.stringify(body) : undefined,
        signal: options?.signal,
      });

    let response = await fetchStreamResponse();

    if (response.status === 401) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        response = await fetchStreamResponse();
      } else {
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Authentication expired');
      }
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.detail || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const apiClient = new ApiClient(BASE_URL);
export default apiClient;
