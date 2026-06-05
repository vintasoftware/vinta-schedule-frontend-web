/**
 * usePublicApiTokens + useCreatePublicApiToken tests.
 *
 * Covers:
 * - usePublicApiTokens returns metadata (no secret).
 * - useCreatePublicApiToken returns the one-time plaintext secret to the caller.
 * - After create the list is invalidated (refetched) but the list response has no secret.
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
    publicApiTokensList: vi.fn(),
    publicApiTokensCreate: vi.fn(),
  };
});

import { publicApiTokensList, publicApiTokensCreate } from '@/client/sdk.gen';
import type {
  PaginatedSystemUserTokenList,
  SystemUserToken,
  SystemUserTokenResponse,
} from '@/client';
import {
  usePublicApiTokens,
  useCreatePublicApiToken,
} from './use-public-api-tokens';

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
    ...overrides,
  };
}

function makeListResponse(
  results: SystemUserToken[],
  count = results.length
): Awaited<ReturnType<typeof publicApiTokensList>> {
  const body: PaginatedSystemUserTokenList = { count, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof publicApiTokensList>>;
}

function makeCreateResponse(
  token: SystemUserToken,
  secret: string
): Awaited<ReturnType<typeof publicApiTokensCreate>> {
  const body: SystemUserTokenResponse = {
    ...token,
    token: secret,
  };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof publicApiTokensCreate>>;
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
// Tests: usePublicApiTokens
// ---------------------------------------------------------------------------

describe('usePublicApiTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns token metadata (no secret field) from the list endpoint', async () => {
    const tokens = [makeToken(1), makeToken(2)];
    vi.mocked(publicApiTokensList).mockResolvedValueOnce(
      makeListResponse(tokens)
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePublicApiTokens(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tokens).toHaveLength(2);
    expect(result.current.tokens[0].integration_name).toBe('Integration 1');
    expect(result.current.tokens[1].integration_name).toBe('Integration 2');
    expect(result.current.totalCount).toBe(2);

    // Verify no secret field exists on the list items
    const firstToken = result.current.tokens[0];
    expect('token' in firstToken).toBe(false);
  });

  it('returns empty list when no tokens exist', async () => {
    vi.mocked(publicApiTokensList).mockResolvedValueOnce(makeListResponse([]));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePublicApiTokens(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tokens).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
  });

  it('exposes isError when the list endpoint fails', async () => {
    vi.mocked(publicApiTokensList).mockRejectedValueOnce(
      new Error('Network error')
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePublicApiTokens(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// Tests: useCreatePublicApiToken
// ---------------------------------------------------------------------------

describe('useCreatePublicApiToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the one-time plaintext secret in the create response', async () => {
    const token = makeToken(42);
    const secret = 'super-secret-token-value';
    vi.mocked(publicApiTokensCreate).mockResolvedValueOnce(
      makeCreateResponse(token, secret)
    );
    // After create, the list is invalidated — mock the refetch
    vi.mocked(publicApiTokensList).mockResolvedValue(
      makeListResponse([token]) // list does NOT include 'token' field
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreatePublicApiToken(), {
      wrapper: Wrapper,
    });

    let createResult: SystemUserTokenResponse | undefined;
    await act(async () => {
      createResult = await result.current.createPublicApiToken({
        integration_name: 'Integration 42',
        available_resources: ['calendar'],
      });
    });

    // The caller receives the full response including the secret
    expect(createResult).toBeDefined();
    expect(createResult?.token).toBe(secret);
    expect(createResult?.id).toBe(42);
    expect(createResult?.integration_name).toBe('Integration 42');
  });

  it('the list query returns metadata only (no secret) after create invalidation', async () => {
    const token = makeToken(10);
    vi.mocked(publicApiTokensCreate).mockResolvedValueOnce(
      makeCreateResponse(token, 'once-secret')
    );
    // The list endpoint refetch returns metadata only — no token field
    vi.mocked(publicApiTokensList).mockResolvedValue(makeListResponse([token]));

    const { Wrapper, queryClient } = createWrapper();

    // Render both hooks so the list query is in the cache
    const { result: listResult } = renderHook(() => usePublicApiTokens(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(listResult.current.isLoading).toBe(false));

    const { result: createResult } = renderHook(
      () => useCreatePublicApiToken(),
      { wrapper: Wrapper }
    );

    await act(async () => {
      await createResult.current.createPublicApiToken({
        integration_name: 'Integration 10',
        available_resources: ['calendar'],
      });
    });

    // Wait for list re-fetch after invalidation
    await waitFor(() => {
      expect(publicApiTokensList).toHaveBeenCalledTimes(2);
    });

    // List query cache must not contain any secret
    const cached = queryClient.getQueryData<PaginatedSystemUserTokenList>([
      { _id: 'publicApiTokensList' },
    ]);
    // Verify list results don't have 'token' field
    if (cached?.results) {
      cached.results.forEach((item) => {
        expect('token' in item).toBe(false);
      });
    }
  });

  it('throws when the create endpoint fails', async () => {
    vi.mocked(publicApiTokensCreate).mockRejectedValueOnce(
      new Error('Duplicate integration name')
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreatePublicApiToken(), {
      wrapper: Wrapper,
    });

    await expect(
      act(async () => {
        await result.current.createPublicApiToken({
          integration_name: 'Dupe',
          available_resources: ['calendar'],
        });
      })
    ).rejects.toThrow('Duplicate integration name');
  });
});
