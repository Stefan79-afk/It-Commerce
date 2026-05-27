import { clearTokens, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from './auth';

export const USERS_API = '/api/users/api/v1/users';
export const PRODUCTS_API = '/api/products/api/v1/products';
export const ORDERS_API = '/api/orders/api/v1/orders';

// Deduplicates concurrent refresh calls so only one hits the server
let _refreshing: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${USERS_API}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const data = (await res.json()) as { accessToken: string; refreshToken?: string; expiresIn: number };
    setAccessToken(data.accessToken);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

export async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const accessToken = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    _refreshing ??= attemptRefresh().finally(() => {
      _refreshing = null;
    });

    const refreshed = await _refreshing;

    if (!refreshed) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      throw new ApiError(res.status, body.message ?? 'Session expired. Please log in again.', body);
    }

    const newToken = getAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
    }
    res = await fetch(url, { ...options, headers });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new ApiError(res.status, body.message ?? res.statusText, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
