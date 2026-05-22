import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request } from './api';
import * as auth from './auth';

beforeEach(() => {
  auth.clearTokens();
  vi.restoreAllMocks();
  // Reset the _refreshing deduplication state between tests by importing fresh module
});

describe('request()', () => {
  it('injects Authorization header when access token is present', async () => {
    auth.setAccessToken('test-token');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'ok' }),
    } as unknown as Response);
    vi.stubGlobal('fetch', mockFetch);

    await request('/api/test');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-token',
    );
  });

  it('omits Authorization header when no access token is set', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'ok' }),
    } as unknown as Response);
    vi.stubGlobal('fetch', mockFetch);

    await request('/api/test');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('retries with new token after 401 followed by successful refresh', async () => {
    auth.setAccessToken('expired-token');
    auth.setRefreshToken('valid-refresh');

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ accessToken: 'new-token', expiresIn: 900 }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'success' }),
      } as unknown as Response);

    vi.stubGlobal('fetch', mockFetch);

    const result = await request<{ data: string }>('/api/protected');

    expect(result.data).toBe('success');
    expect(mockFetch).toHaveBeenCalledTimes(3);

    const [, retryOptions] = mockFetch.mock.calls[2] as [string, RequestInit];
    expect((retryOptions.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer new-token',
    );
  });

  it('throws ApiError and clears tokens when 401 and refresh also fails', async () => {
    auth.setAccessToken('expired-token');
    auth.setRefreshToken('invalid-refresh');

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid refresh token' }),
      } as unknown as Response);

    vi.stubGlobal('fetch', mockFetch);

    await expect(request('/api/protected')).rejects.toThrow(ApiError);
    expect(auth.getAccessToken()).toBeNull();
    expect(auth.getRefreshToken()).toBeNull();
  });

  it('throws ApiError with correct status for non-401 errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: 'Resource not found' }),
    } as unknown as Response);
    vi.stubGlobal('fetch', mockFetch);

    await expect(request('/api/missing')).rejects.toMatchObject({
      status: 404,
      message: 'Resource not found',
    });
  });
});
