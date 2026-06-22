/**
 * useChangeRequests / useApproveChangeRequest / useRejectChangeRequest tests.
 *
 * Covers:
 *  - useChangeRequests maps page/pageSize → limit/offset and forwards status.
 *  - useChangeRequests surfaces results / count / loading / error.
 *  - useApproveChangeRequest calls changeRequestsApproveCreate with the id and
 *    invalidates the change-requests list on success.
 *  - useRejectChangeRequest calls changeRequestsRejectCreate with the id and
 *    invalidates the change-requests list on success.
 *  - Errors propagate to the caller.
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
    changeRequestsList: vi.fn(),
    changeRequestsApproveCreate: vi.fn(),
    changeRequestsRejectCreate: vi.fn(),
  };
});

import {
  changeRequestsList,
  changeRequestsApproveCreate,
  changeRequestsRejectCreate,
} from '@/client/sdk.gen';
import {
  useChangeRequests,
  useApproveChangeRequest,
  useRejectChangeRequest,
} from './use-change-requests';
import type { ExternalEventChangeRequest } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeChangeRequest(
  overrides: Partial<ExternalEventChangeRequest> = {}
): ExternalEventChangeRequest {
  return {
    id: 7,
    event_id: 42,
    kind: 'update',
    status: 'pending',
    provider: 'google',
    proposed_values: { title: 'New title' },
    retained_values: { title: 'Old title' },
    resolved_by_user_id: null,
    resolved_at: null,
    created: '2026-06-01T10:00:00Z',
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeListResponse(results: ExternalEventChangeRequest[]): any {
  return {
    data: { count: results.length, next: null, previous: null, results },
    response: new Response(null, { status: 200 }),
    request: new Request('https://example.com'),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeItemResponse(item: ExternalEventChangeRequest): any {
  return {
    data: item,
    response: new Response(null, { status: 200 }),
    request: new Request('https://example.com'),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }
  return { Wrapper, queryClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useChangeRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps page/pageSize → limit/offset and forwards status', async () => {
    vi.mocked(changeRequestsList).mockResolvedValue(makeListResponse([]));

    const { Wrapper } = makeQueryWrapper();
    renderHook(
      () =>
        useChangeRequests({
          query: { page: 3, pageSize: 20, ordering: null, search: null },
          status: 'approved',
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(changeRequestsList).toHaveBeenCalled());

    const call = vi.mocked(changeRequestsList).mock.calls[0][0];
    expect(call?.query).toMatchObject({
      limit: 20,
      offset: 40,
      status: 'approved',
    });
  });

  it('surfaces results and count', async () => {
    const item = makeChangeRequest();
    vi.mocked(changeRequestsList).mockResolvedValue(makeListResponse([item]));

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(
      () =>
        useChangeRequests({
          query: { page: 1, pageSize: 20, ordering: null, search: null },
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.changeRequests).toEqual([item]);
    expect(result.current.totalCount).toBe(1);
    expect(result.current.isError).toBe(false);
  });

  it('exposes the error state when the request fails', async () => {
    vi.mocked(changeRequestsList).mockRejectedValue(new Error('boom'));

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(
      () =>
        useChangeRequests({
          query: { page: 1, pageSize: 20, ordering: null, search: null },
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.changeRequests).toEqual([]);
  });
});

describe('useApproveChangeRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls changeRequestsApproveCreate with the id and invalidates the list', async () => {
    const resolved = makeChangeRequest({ status: 'approved' });
    vi.mocked(changeRequestsApproveCreate).mockResolvedValue(
      makeItemResponse(resolved)
    );

    const { Wrapper, queryClient } = makeQueryWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useApproveChangeRequest(), {
      wrapper: Wrapper,
    });

    const returned = await result.current.approveChangeRequest(7);

    expect(changeRequestsApproveCreate).toHaveBeenCalledOnce();
    expect(
      vi.mocked(changeRequestsApproveCreate).mock.calls[0][0]
    ).toMatchObject({ path: { id: '7' } });
    expect(returned).toEqual(resolved);
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('propagates backend errors to the caller', async () => {
    vi.mocked(changeRequestsApproveCreate).mockRejectedValue(
      new Error('Request is no longer PENDING')
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useApproveChangeRequest(), {
      wrapper: Wrapper,
    });

    await expect(result.current.approveChangeRequest(7)).rejects.toThrow(
      'Request is no longer PENDING'
    );
  });
});

describe('useRejectChangeRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls changeRequestsRejectCreate with the id and invalidates the list', async () => {
    const resolved = makeChangeRequest({ status: 'rejected' });
    vi.mocked(changeRequestsRejectCreate).mockResolvedValue(
      makeItemResponse(resolved)
    );

    const { Wrapper, queryClient } = makeQueryWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRejectChangeRequest(), {
      wrapper: Wrapper,
    });

    await result.current.rejectChangeRequest(7);

    expect(changeRequestsRejectCreate).toHaveBeenCalledOnce();
    expect(
      vi.mocked(changeRequestsRejectCreate).mock.calls[0][0]
    ).toMatchObject({ path: { id: '7' } });
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('propagates backend errors to the caller', async () => {
    vi.mocked(changeRequestsRejectCreate).mockRejectedValue(
      new Error('Caller is not eligible')
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useRejectChangeRequest(), {
      wrapper: Wrapper,
    });

    await expect(result.current.rejectChangeRequest(7)).rejects.toThrow(
      'Caller is not eligible'
    );
  });
});
