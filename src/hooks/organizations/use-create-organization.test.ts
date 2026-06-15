/**
 * useCreateOrganization tests.
 *
 * Covers:
 * - On success, BOTH CURRENT_ORGANIZATION_QUERY_KEY and MY_ORGANIZATIONS_QUERY_KEY
 *   are invalidated.
 * - createOrganization resolves to the created Organization (returned from the API).
 * - On failure, the mutation throws and does not invalidate either query key.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { Organization } from '@/client';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    organizationsCreate: vi.fn(),
  };
});

import { organizationsCreate } from '@/client/sdk.gen';
import { CURRENT_ORGANIZATION_QUERY_KEY } from './use-current-organization';
import { MY_ORGANIZATIONS_QUERY_KEY } from './use-my-organizations';
import { useCreateOrganization } from './use-create-organization';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NEW_ORG: Organization = {
  id: 7,
  name: 'New Org',
  google_service_account: null,
  created: '2026-01-01T00:00:00Z',
  modified: '2026-01-01T00:00:00Z',
};

function makeSuccessResponse(
  org: Organization
): Awaited<ReturnType<typeof organizationsCreate>> {
  return {
    data: org,
    response: new Response(JSON.stringify(org), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof organizationsCreate>>;
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

describe('useCreateOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Both query keys invalidated on success
  // -------------------------------------------------------------------------

  it('invalidates CURRENT_ORGANIZATION_QUERY_KEY on success', async () => {
    vi.mocked(organizationsCreate).mockResolvedValue(
      makeSuccessResponse(NEW_ORG)
    );

    const { Wrapper, queryClient } = makeQueryWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateOrganization(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.createOrganization({ name: 'New Org' });
    });

    await waitFor(() => {
      expect(
        invalidateSpy.mock.calls.some(
          (call) =>
            JSON.stringify(call[0]) ===
            JSON.stringify({ queryKey: CURRENT_ORGANIZATION_QUERY_KEY })
        )
      ).toBe(true);
    });
  });

  it('invalidates MY_ORGANIZATIONS_QUERY_KEY on success', async () => {
    vi.mocked(organizationsCreate).mockResolvedValue(
      makeSuccessResponse(NEW_ORG)
    );

    const { Wrapper, queryClient } = makeQueryWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateOrganization(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.createOrganization({ name: 'New Org' });
    });

    await waitFor(() => {
      expect(
        invalidateSpy.mock.calls.some(
          (call) =>
            JSON.stringify(call[0]) ===
            JSON.stringify({ queryKey: MY_ORGANIZATIONS_QUERY_KEY })
        )
      ).toBe(true);
    });
  });

  it('invalidates both query keys on a single successful create', async () => {
    vi.mocked(organizationsCreate).mockResolvedValue(
      makeSuccessResponse(NEW_ORG)
    );

    const { Wrapper, queryClient } = makeQueryWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateOrganization(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.createOrganization({ name: 'New Org' });
    });

    await waitFor(() => {
      // Exactly two invalidation calls: one for current, one for mine/
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // Resolves with the created Organization
  // -------------------------------------------------------------------------

  it('resolves with the created Organization on success', async () => {
    vi.mocked(organizationsCreate).mockResolvedValue(
      makeSuccessResponse(NEW_ORG)
    );

    const { Wrapper } = makeQueryWrapper();

    const { result } = renderHook(() => useCreateOrganization(), {
      wrapper: Wrapper,
    });

    let createdOrg: Organization | undefined;
    await act(async () => {
      createdOrg = await result.current.createOrganization({ name: 'New Org' });
    });

    expect(createdOrg).toEqual(NEW_ORG);
    expect(createdOrg?.id).toBe(7);
    expect(createdOrg?.name).toBe('New Org');
  });

  // -------------------------------------------------------------------------
  // No invalidation on failure
  // -------------------------------------------------------------------------

  it('does NOT invalidate any query key when the API fails', async () => {
    vi.mocked(organizationsCreate).mockRejectedValue(
      new Error('Internal Server Error')
    );

    const { Wrapper, queryClient } = makeQueryWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateOrganization(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current
        .createOrganization({ name: 'Fail Org' })
        .catch(() => {
          /* expected */
        });
    });

    await waitFor(() =>
      expect(result.current.createOrganizationMutation.isError).toBe(true)
    );

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
