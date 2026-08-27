/**
 * usePublicApiScopes tests.
 *
 * Covers:
 * - The catalog is read from GET /public-api-docs/scopes/ and returned in the
 *   order the API sent it (the backend's enum declaration order).
 * - Before the response lands, callers see an empty list rather than undefined,
 *   so a `.map` over it is always safe.
 * - A failed request surfaces as isError with an empty list, never a partial or
 *   stale catalog.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    publicApiDocsScopesList: vi.fn(),
  };
});

import { publicApiDocsScopesList } from '@/client/sdk.gen';
import type { SystemUserScope } from '@/client';
import { usePublicApiScopes } from './use-public-api-scopes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATALOG: SystemUserScope[] = [
  { value: 'calendar_event', label: 'Calendar Event', provider_scoped: true },
  { value: 'calendar', label: 'Calendar', provider_scoped: true },
  { value: 'user', label: 'User', provider_scoped: false },
];

function makeResponse(scopes: SystemUserScope[]) {
  return {
    data: scopes,
    response: new Response(JSON.stringify(scopes), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof publicApiDocsScopesList>>;
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePublicApiScopes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the catalog in the order the API sent it', async () => {
    vi.mocked(publicApiDocsScopesList).mockResolvedValue(makeResponse(CATALOG));

    const { result } = renderHook(() => usePublicApiScopes(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Full value, not a length or a truthiness check: the order is part of the
    // contract (the picker renders it as received) and so are the labels.
    expect(result.current.scopes).toEqual(CATALOG);
    expect(result.current.isError).toBe(false);
  });

  it('returns an empty list while the request is in flight', () => {
    vi.mocked(publicApiDocsScopesList).mockReturnValue(
      new Promise(() => {}) as unknown as ReturnType<
        typeof publicApiDocsScopesList
      >
    );

    const { result } = renderHook(() => usePublicApiScopes(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.scopes).toEqual([]);
  });

  it('reports an error with an empty list when the request fails', async () => {
    vi.mocked(publicApiDocsScopesList).mockRejectedValue(
      new Error('catalog unavailable')
    );

    const { result } = renderHook(() => usePublicApiScopes(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.scopes).toEqual([]);
  });
});
