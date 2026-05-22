import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, request, USERS_API } from '../lib/api';
import {
  clearTokens,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../lib/auth';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthState {
  loggedIn: boolean;
  loading: boolean;
  userId: string | null;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

function parseUserId(token: string): string | null {
  try {
    // JWT payload is URL-safe base64; replaceAll handles all occurrences
    const b64 = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
    const payload = JSON.parse(atob(b64)) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [state, setState] = useState<AuthState>({ loggedIn: false, loading: true, userId: null });

  useEffect(() => {
    const refresh = getRefreshToken();
    if (!refresh) {
      setState({ loggedIn: false, loading: false, userId: null });
      return;
    }

    fetch(`${USERS_API}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Refresh failed');
        return res.json() as Promise<{ accessToken: string }>;
      })
      .then((data) => {
        setAccessToken(data.accessToken);
        setState({ loggedIn: true, loading: false, userId: parseUserId(data.accessToken) });
      })
      .catch(() => {
        clearTokens();
        setState({ loggedIn: false, loading: false, userId: null });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await request<LoginResponse>(`${USERS_API}/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setState({ loggedIn: true, loading: false, userId: parseUserId(data.accessToken) });
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await request(`${USERS_API}/logout`, {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch (err) {
        if (err instanceof ApiError && err.status !== 401) {
          console.error('Logout request failed', err);
        }
      }
    }
    clearTokens();
    setState({ loggedIn: false, loading: false, userId: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
