/**
 * useRevokePublicApiToken tests.
 *
 * Covers:
 * - Revoke calls publicApiTokensRevokeCreate with the token id.
 * - On success, the list query key is invalidated.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    publicApiTokensRevokeCreate: vi.fn(),
  };
});

import { publicApiTokensRevokeCreate } from '@/client/sdk.gen';
import type { SystemUserToken } from '@/client';
import { useRevokePublicApiToken } from './use-revoke-public-api-token';
import { PUBLIC_API_TOKENS_QUERY_KEY } from './use-public-api-tokens';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToken(
  id: number,
  overrides: Partial<SystemUserToken> = {}
): SystemUserToken {
  return {
    id,
    integration_name: `Integration ${id}`,
    is_active: true,
    available_resources: ['calendar'],
    scoped_to_user: null,
    ...overrides,
  };
}

function makeRevokeResponse(
  token: SystemUserToken
): Awaited<ReturnType<typeof publicApiTokensRevokeCreate>> {
  return {
    data: token,
    response: new Response(JSON.stringify(token), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof publicApiTokensRevokeCreate>>;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, queryClient };
}

// ---------------------------------------------------------------------------
// Tests: useRevokePublicApiToken
// ---------------------------------------------------------------------------

describe('useRevokePublicApiToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls publicApiTokensRevokeCreate with the token id', async () => {
    const revokedToken = makeToken(42, { is_active: false });
    vi.mocked(publicApiTokensRevokeCreate).mockResolvedValueOnce(
      makeRevokeResponse(revokedToken)
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRevokePublicApiToken(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.revokeToken('42');
    });

    expect(vi.mocked(publicApiTokensRevokeCreate)).toHaveBeenCalledOnce();
    expect(vi.mocked(publicApiTokensRevokeCreate)).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: '42' },
      })
    );
  });

  it('invalidates the list query key on success', async () => {
    const revokedToken = makeToken(10, { is_active: false });
    vi.mocked(publicApiTokensRevokeCreate).mockResolvedValueOnce(
      makeRevokeResponse(revokedToken)
    );

    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useRevokePublicApiToken(), {
      wrapper: Wrapper,
    });

    // Set a dummy entry in the query cache so we can verify invalidation
    queryClient.setQueryData(PUBLIC_API_TOKENS_QUERY_KEY, {
      results: [makeToken(10, { is_active: true })],
      count: 1,
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.revokeToken('10');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: PUBLIC_API_TOKENS_QUERY_KEY,
    });
  });

  it('throws when the revoke endpoint fails', async () => {
    vi.mocked(publicApiTokensRevokeCreate).mockRejectedValueOnce(
      new Error('Token not found')
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRevokePublicApiToken(), {
      wrapper: Wrapper,
    });

    await expect(
      act(async () => {
        await result.current.revokeToken('999');
      })
    ).rejects.toThrow('Token not found');
  });
});
