// src/lib/api.ts — Axios client with JWT auto-injection and refresh

// We use a dynamic import of axios-style fetch wrapper without actually
// requiring axios to avoid adding a new dependency. Uses native fetch instead.

// ─── Token store (in-memory only — never in localStorage) ────────────────────
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
  socketId?: string;
}

async function apiRequest<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { skipAuth = false, socketId, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  if (!skipAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (socketId) {
    headers['X-Socket-Id'] = socketId;
  }

  const response = await fetch(path, { ...fetchOptions, headers });

  // Auto-refresh on 401
  if (response.status === 401 && !skipAuth) {
    const errorBody = await response.clone().json().catch(() => ({})) as any;
    if (errorBody?.code === 'TOKEN_EXPIRED' || errorBody?.error?.includes('Token expired')) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(path, { ...fetchOptions, headers });
        if (!retryResponse.ok) {
          const err = await retryResponse.json().catch(() => ({})) as any;
          throw new ApiError(retryResponse.status, err?.error || 'Request failed');
        }
        return retryResponse.json() as Promise<T>;
      }
    }
    // Clear token and let the app re-authenticate
    clearAccessToken();
    throw new ApiError(401, 'Authentication required');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as any;
    throw new ApiError(response.status, err?.error || `HTTP ${response.status}`);
  }

  // 204 No Content
  if (response.status === 204) return {} as T;

  return response.json() as Promise<T>;
}

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshAccessToken(): Promise<string | null> {
  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // Include HttpOnly refresh cookie
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) return null;
      const data = await response.json() as { accessToken: string };
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ─── Error class ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── API client ───────────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, opts?: ApiOptions) =>
    apiRequest<T>(`/api${path}`, { method: 'GET', ...opts }),

  post: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    apiRequest<T>(`/api${path}`, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...opts,
    }),

  put: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    apiRequest<T>(`/api${path}`, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...opts,
    }),

  patch: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    apiRequest<T>(`/api${path}`, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...opts,
    }),

  delete: <T>(path: string, opts?: ApiOptions) =>
    apiRequest<T>(`/api${path}`, { method: 'DELETE', ...opts }),

  // Auth-specific helpers
  login: (email: string, password: string) =>
    api.post<{ accessToken: string; user: any }>('/auth/login', { email, password }, { skipAuth: true }),

  logout: () =>
    api.post<{ ok: boolean }>('/auth/logout', undefined, { skipAuth: true }),

  refresh: refreshAccessToken,

  // Load full app state
  loadState: (socketId?: string) =>
    api.get<Record<string, unknown>>('/state', { socketId }),

  // Post a dispatch mutation to sync across all clients
  mutation: (type: string, payload: unknown, socketId?: string) =>
    api.post<{ ok: boolean }>('/state/mutations', { type, payload }, { socketId }).catch((err) => {
      // Mutations failing should not crash the UI — just log
      console.warn(`[api] Mutation sync failed [${type}]:`, err.message);
    }),
};

// ─── On-startup: try to restore session via refresh cookie ───────────────────

export async function tryRestoreSession(): Promise<{ accessToken: string; user: any } | null> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) return null;
    const data = await response.json() as { accessToken: string; user: any };
    setAccessToken(data.accessToken);
    return data;
  } catch {
    return null;
  }
}
