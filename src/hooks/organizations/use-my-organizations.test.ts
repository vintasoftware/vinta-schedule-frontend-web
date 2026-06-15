/**
 * useMyOrganizations tests.
 *
 * Covers:
 * - 200 → returns memberships array + isGated:false, isMultiOrg varies by length
 * - 2 orgs → isMultiOrg:true, isGated:false
 * - 0 orgs → isGated:true, isMultiOrg:false
 * - enabled:false → query not fired
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    organizationsMineList: vi.fn(),
  };
});

import { organizationsMineList } from '@/client/sdk.gen';
import type { MyMembership } from '@/client';
import { useMyOrganizations } from './use-my-organizations';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_MEMBERSHIP_1: MyMembership = {
  organization: {
    id: 1,
    name: 'Org 1',
  },
  role: 'admin',
};

const FIXTURE_MEMBERSHIP_2: MyMembership = {
  organization: {
    id: 2,
    name: 'Org 2',
  },
  role: 'member',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeListResponse(
  data: MyMembership[]
): Awaited<ReturnType<typeof organizationsMineList>> {
  return {
    data,
    response: new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof organizationsMineList>>;
}

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

describe('useMyOrganizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 2 memberships → isMultiOrg:true, isGated:false
  // -------------------------------------------------------------------------

  it('returns 2 memberships with isMultiOrg:true and isGated:false', async () => {
    const memberships = [FIXTURE_MEMBERSHIP_1, FIXTURE_MEMBERSHIP_2];
    vi.mocked(organizationsMineList).mockResolvedValue(
      makeListResponse(memberships)
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useMyOrganizations(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.memberships).toEqual(memberships);
    expect(result.current.memberships.length).toBe(2);
    expect(result.current.isMultiOrg).toBe(true);
    expect(result.current.isGated).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 0 memberships (gated) → isGated:true, isMultiOrg:false
  // -------------------------------------------------------------------------

  it('returns empty array with isGated:true and isMultiOrg:false when gated', async () => {
    vi.mocked(organizationsMineList).mockResolvedValue(makeListResponse([]));

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useMyOrganizations(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.memberships).toEqual([]);
    expect(result.current.memberships.length).toBe(0);
    expect(result.current.isGated).toBe(true);
    expect(result.current.isMultiOrg).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 1 membership → isMultiOrg:false, isGated:false
  // -------------------------------------------------------------------------

  it('returns 1 membership with isMultiOrg:false and isGated:false', async () => {
    const memberships = [FIXTURE_MEMBERSHIP_1];
    vi.mocked(organizationsMineList).mockResolvedValue(
      makeListResponse(memberships)
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useMyOrganizations(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.memberships).toEqual(memberships);
    expect(result.current.memberships.length).toBe(1);
    expect(result.current.isMultiOrg).toBe(false);
    expect(result.current.isGated).toBe(false);
  });

  // -------------------------------------------------------------------------
  // disabled when enabled:false → query not fired
  // -------------------------------------------------------------------------

  it('does not fire the query when enabled is false', async () => {
    vi.mocked(organizationsMineList).mockResolvedValue(
      makeListResponse([FIXTURE_MEMBERSHIP_1, FIXTURE_MEMBERSHIP_2])
    );

    const { Wrapper } = makeQueryWrapper();
    renderHook(() => useMyOrganizations({ enabled: false }), {
      wrapper: Wrapper,
    });

    await new Promise((r) => setTimeout(r, 20));

    // With enabled:false, the query should not fire.
    // organizationsMineList is called by the generated queryFn, so it
    // should not have been called.
    expect(organizationsMineList).not.toHaveBeenCalled();
  });
});
