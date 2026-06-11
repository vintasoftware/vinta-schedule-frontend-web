import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import {
  useServiceAccount,
  useUpsertServiceAccount,
  useDeleteServiceAccount,
  SERVICE_ACCOUNT_QUERY_KEY,
} from './use-service-account';
import * as sdk from '@/client/sdk.gen';
import type { ServiceAccountRead } from '@/client';
import { serviceAccountsListQueryKey } from '@/client/@tanstack/react-query.gen';

vi.mock('@/client/sdk.gen');

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createQueryClient();
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    children
  );
};

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const mockServiceAccount: ServiceAccountRead = {
  id: 1,
  email: 'my-sa@project.iam.gserviceaccount.com',
  audience: 'https://example.com',
  configured: true,
  created: '2024-01-01T00:00:00Z',
  modified: '2024-06-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// useServiceAccount
// ---------------------------------------------------------------------------

describe('useServiceAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the first result from the list', async () => {
    vi.mocked(sdk.serviceAccountsList).mockResolvedValue({
      data: { count: 1, results: [mockServiceAccount] },
      response: new Response(null, { status: 200 }),
      request: new Request('https://api.example.com'),
      error: undefined,
    });

    const { result } = renderHook(() => useServiceAccount(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.serviceAccount).toEqual(mockServiceAccount);
    expect(result.current.isConfigured).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('returns null when the list is empty', async () => {
    vi.mocked(sdk.serviceAccountsList).mockResolvedValue({
      data: { count: 0, results: [] },
      response: new Response(null, { status: 200 }),
      request: new Request('https://api.example.com'),
      error: undefined,
    });

    const { result } = renderHook(() => useServiceAccount(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.serviceAccount).toBeNull();
    expect(result.current.isConfigured).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SERVICE_ACCOUNT_QUERY_KEY — generated key prefix-matches parameterised keys
//
// This test verifies the fix for the cache-key invalidation bug:
//
//   Old (broken): ['serviceAccountsList'] — plain string array. TanStack Query
//   stores keys as object arrays [{ _id, baseUrl, query, … }], so the string
//   array NEVER prefix-matches and invalidateQueries is a silent no-op.
//
//   New (correct): serviceAccountsListQueryKey() — returns the same object
//   shape [{ _id, baseUrl }] that the list options factory uses, so it
//   prefix-matches all parameterised variants (e.g. { query: { limit: 1 } }).
// ---------------------------------------------------------------------------

describe('SERVICE_ACCOUNT_QUERY_KEY', () => {
  it('is derived from the generated factory (object shape, not a plain string array)', () => {
    // The key must be an array whose first element is an object with _id.
    expect(Array.isArray(SERVICE_ACCOUNT_QUERY_KEY)).toBe(true);
    expect(typeof SERVICE_ACCOUNT_QUERY_KEY[0]).toBe('object');
    expect((SERVICE_ACCOUNT_QUERY_KEY[0] as Record<string, unknown>)._id).toBe(
      'serviceAccountsList'
    );
  });

  it('prefix-matches the parameterised list key used by useServiceAccount', () => {
    // The hook queries with { query: { limit: 1 } }. The generated key
    // for that call includes _id, baseUrl, AND query. The base key (no params)
    // must be a prefix of that parameterised key so TanStack Query's
    // invalidateQueries({ queryKey: SERVICE_ACCOUNT_QUERY_KEY }) actually fires.
    const paramKey = serviceAccountsListQueryKey({
      query: { limit: 1 },
    })[0] as Record<string, unknown>;
    const baseKey = SERVICE_ACCOUNT_QUERY_KEY[0] as Record<string, unknown>;

    // _id and baseUrl must match
    expect(paramKey._id).toBe(baseKey._id);
    expect(paramKey.baseUrl).toBe(baseKey.baseUrl);

    // The parameterised key carries extra fields that the base key omits —
    // that's what makes the base key a prefix (partial match) rather than exact.
    expect(paramKey.query).toEqual({ limit: 1 });
    expect(baseKey.query).toBeUndefined();

    // Sanity-check: the OLD hand-rolled key ['serviceAccountsList'] would NOT
    // prefix-match because it is a plain string, not an object with _id/baseUrl.
    const oldKey = [
      'serviceAccountsList',
    ] as unknown as typeof SERVICE_ACCOUNT_QUERY_KEY;
    expect(typeof (oldKey[0] as unknown)).toBe('string');
    // Its first element is a string, while the parameterised key's first element
    // is an object — they can never match.
    expect(typeof paramKey).not.toBe('string');
  });
});

// ---------------------------------------------------------------------------
// useUpsertServiceAccount — create when none exists
// ---------------------------------------------------------------------------

describe('useUpsertServiceAccount — create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls serviceAccountsCreate when no existingId is passed', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      data: mockServiceAccount,
      response: new Response(null, { status: 201 }),
      request: new Request('https://api.example.com'),
      error: undefined,
    });
    vi.mocked(sdk.serviceAccountsCreate).mockImplementation(
      mockCreate as unknown as typeof sdk.serviceAccountsCreate
    );

    // Also mock list so invalidation doesn't fail
    vi.mocked(sdk.serviceAccountsList).mockResolvedValue({
      data: { count: 0, results: [] },
      response: new Response(null, { status: 200 }),
      request: new Request('https://api.example.com'),
      error: undefined,
    });

    const { result } = renderHook(() => useUpsertServiceAccount(), { wrapper });

    await act(async () => {
      await result.current.saveServiceAccount({
        email: 'sa@project.iam.gserviceaccount.com',
        audience: 'https://example.com',
        public_key: '-----BEGIN CERTIFICATE-----',
        private_key_id: 'key-id-123',
        private_key: '-----BEGIN RSA PRIVATE KEY-----',
      });
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: 'sa@project.iam.gserviceaccount.com',
          audience: 'https://example.com',
          public_key: '-----BEGIN CERTIFICATE-----',
          private_key_id: 'key-id-123',
          private_key: '-----BEGIN RSA PRIVATE KEY-----',
        }),
      })
    );
    // Verify PATCH was NOT called
    expect(sdk.serviceAccountsPartialUpdate).not.toHaveBeenCalled();
  });

  it('invalidates SERVICE_ACCOUNT_QUERY_KEY (generated object key) after create, prefix-matching the parameterised list key', async () => {
    // This test would FAIL with the old hand-rolled ['serviceAccountsList']
    // key because invalidateQueries uses prefix/object matching and a plain
    // string array never matches the [{ _id, baseUrl, query }] shape stored in
    // the cache by serviceAccountsListOptions({ query: { limit: 1 } }).

    vi.mocked(sdk.serviceAccountsCreate).mockResolvedValue({
      data: mockServiceAccount,
      response: new Response(null, { status: 201 }),
      request: new Request('https://api.example.com'),
      error: undefined,
    });

    vi.mocked(sdk.serviceAccountsList).mockResolvedValue({
      data: { count: 1, results: [mockServiceAccount] },
      response: new Response(null, { status: 200 }),
      request: new Request('https://api.example.com'),
      error: undefined,
    });

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const customWrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      );

    const { result } = renderHook(() => useUpsertServiceAccount(), {
      wrapper: customWrapper,
    });

    await act(async () => {
      await result.current.saveServiceAccount({
        email: 'sa@project.iam.gserviceaccount.com',
        audience: 'https://example.com',
        public_key: '-----BEGIN CERTIFICATE-----',
        private_key_id: 'key-id-123',
        private_key: '-----BEGIN RSA PRIVATE KEY-----',
      });
    });

    // The invalidation must be called with the generated object-shaped key.
    // With the OLD ['serviceAccountsList'] key this assertion would still pass
    // (the spy sees what was passed to invalidateQueries) — but the CACHE would
    // not actually be invalidated because TanStack Query can't match the shapes.
    // The key-shape assertions in the SERVICE_ACCOUNT_QUERY_KEY describe block
    // above prove the prefix-match works at the structural level.
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: SERVICE_ACCOUNT_QUERY_KEY,
      })
    );
    // Confirm the key element is an object (not a string), proving it's the
    // generated key and not the old hand-rolled plain-string key.
    expect(typeof (SERVICE_ACCOUNT_QUERY_KEY[0] as unknown)).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// useUpsertServiceAccount — patch when existingId is passed
// ---------------------------------------------------------------------------

describe('useUpsertServiceAccount — patch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls serviceAccountsPartialUpdate with the existing id when existingId is passed', async () => {
    const mockPatch = vi.fn().mockResolvedValue({
      data: mockServiceAccount,
      response: new Response(null, { status: 200 }),
      request: new Request('https://api.example.com'),
      error: undefined,
    });
    vi.mocked(sdk.serviceAccountsPartialUpdate).mockImplementation(
      mockPatch as unknown as typeof sdk.serviceAccountsPartialUpdate
    );

    // Also mock list so invalidation doesn't fail
    vi.mocked(sdk.serviceAccountsList).mockResolvedValue({
      data: { count: 1, results: [mockServiceAccount] },
      response: new Response(null, { status: 200 }),
      request: new Request('https://api.example.com'),
      error: undefined,
    });

    const { result } = renderHook(() => useUpsertServiceAccount(), { wrapper });

    await act(async () => {
      await result.current.saveServiceAccount(
        {
          email: 'rotated@project.iam.gserviceaccount.com',
          audience: 'https://example.com',
          public_key: '-----BEGIN CERTIFICATE-----',
          private_key_id: 'new-key-id',
          private_key: '-----BEGIN RSA PRIVATE KEY-----',
        },
        42 // existing id
      );
    });

    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: '42' },
        body: expect.objectContaining({
          email: 'rotated@project.iam.gserviceaccount.com',
          private_key_id: 'new-key-id',
          private_key: '-----BEGIN RSA PRIVATE KEY-----',
        }),
      })
    );
    // Verify POST was NOT called
    expect(sdk.serviceAccountsCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useDeleteServiceAccount
// ---------------------------------------------------------------------------

describe('useDeleteServiceAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls serviceAccountsDestroy with the id and invalidates the query key', async () => {
    const mockDestroy = vi.fn().mockResolvedValue({
      data: undefined,
      response: new Response(null, { status: 204 }),
      request: new Request('https://api.example.com'),
      error: undefined,
    });
    vi.mocked(sdk.serviceAccountsDestroy).mockImplementation(
      mockDestroy as unknown as typeof sdk.serviceAccountsDestroy
    );

    vi.mocked(sdk.serviceAccountsList).mockResolvedValue({
      data: { count: 0, results: [] },
      response: new Response(null, { status: 200 }),
      request: new Request('https://api.example.com'),
      error: undefined,
    });

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const customWrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      );

    const { result } = renderHook(() => useDeleteServiceAccount(), {
      wrapper: customWrapper,
    });

    await act(async () => {
      await result.current.deleteServiceAccount(99);
    });

    expect(mockDestroy).toHaveBeenCalledTimes(1);
    expect(mockDestroy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: '99' },
      })
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: SERVICE_ACCOUNT_QUERY_KEY,
      })
    );
  });
});
