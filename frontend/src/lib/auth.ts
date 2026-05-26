const REFRESH_TOKEN_KEY = 'refreshToken';

let _accessToken: string | null = null;

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } else {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }
}

export function clearTokens(): void {
  _accessToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return _accessToken !== null;
}
