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
