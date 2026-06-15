/**
 * useActiveOrganization tests.
 *
 * Covers:
 * - Valid stored id kept; activeMembership resolves
 * - Single membership + empty store → store auto-set to that org id (string)
 * - 2+ memberships + empty store → store stays empty; needsSelection === true
 * - Stale stored id (not in memberships) → cleared (then single/multi rule applies)
 * - setActive(id) writes the store AND calls queryClient.invalidateQueries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
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
import {
  getActiveOrganizationId,
  setActiveOrganizationId,
  clearActiveOrganization,
  ACTIVE_ORGANIZATION_STORAGE_KEY,
} from '@/lib/active-organization';
import { useActiveOrganization } from './use-active-organization';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_MEMBERSHIP_1: MyMembership = {
  organization: { id: 1, name: 'Org 1' },
  role: 'admin',
};

const FIXTURE_MEMBERSHIP_2: MyMembership = {
  organization: { id: 2, name: 'Org 2' },
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

/**
 * Reset module-level state between tests.
 * The store caches a value in its module-level `initialized` flag; we need to
 * clear localStorage AND reset the store via clearActiveOrganization so the
 * next call to getActiveOrganizationId reads a fresh value.
 */
function resetStore() {
  localStorage.removeItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
  clearActiveOrganization();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useActiveOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  // -------------------------------------------------------------------------
  // Valid stored id → kept; activeMembership resolves
  // -------------------------------------------------------------------------

  it('keeps a valid stored id and resolves activeMembership', async () => {
    // Pre-set a valid stored id
    setActiveOrganizationId('1');

    vi.mocked(organizationsMineList).mockResolvedValue(
      makeListResponse([FIXTURE_MEMBERSHIP_1, FIXTURE_MEMBERSHIP_2])
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useActiveOrganization(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeOrganizationId).toBe('1');
    expect(result.current.activeMembership).toEqual(FIXTURE_MEMBERSHIP_1);
    expect(result.current.needsSelection).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Single membership + empty store → auto-set to that org id
  // -------------------------------------------------------------------------

  it('auto-sets the store to the single membership org id when store is empty', async () => {
    vi.mocked(organizationsMineList).mockResolvedValue(
      makeListResponse([FIXTURE_MEMBERSHIP_1])
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useActiveOrganization(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The hook should auto-set the store.
    await waitFor(() => expect(result.current.activeOrganizationId).toBe('1'));

    expect(result.current.activeMembership).toEqual(FIXTURE_MEMBERSHIP_1);
    expect(result.current.needsSelection).toBe(false);
    // Verify the store itself was written (string form).
    expect(getActiveOrganizationId()).toBe('1');
    expect(localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY)).toBe('1');
  });

  // -------------------------------------------------------------------------
  // 2+ memberships + empty store → store stays empty; needsSelection === true
  // -------------------------------------------------------------------------

  it('leaves store empty and reports needsSelection when multi-org and no stored id', async () => {
    vi.mocked(organizationsMineList).mockResolvedValue(
      makeListResponse([FIXTURE_MEMBERSHIP_1, FIXTURE_MEMBERSHIP_2])
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useActiveOrganization(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeOrganizationId).toBeNull();
    expect(result.current.activeMembership).toBeNull();
    expect(result.current.needsSelection).toBe(true);
    expect(getActiveOrganizationId()).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Stale stored id → cleared → then single/multi rule applies
  // -------------------------------------------------------------------------

  it('clears a stale stored id and auto-sets single membership', async () => {
    // Stale id — not in the memberships list
    setActiveOrganizationId('999');

    vi.mocked(organizationsMineList).mockResolvedValue(
      makeListResponse([FIXTURE_MEMBERSHIP_1])
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useActiveOrganization(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // After clearing the stale id, single-org rule auto-resolves to '1'.
    await waitFor(() => expect(result.current.activeOrganizationId).toBe('1'));

    expect(result.current.activeMembership).toEqual(FIXTURE_MEMBERSHIP_1);
    expect(result.current.needsSelection).toBe(false);
  });

  it('clears a stale stored id and leaves unset for multi-org', async () => {
    // Stale id — not in the memberships list
    setActiveOrganizationId('999');

    vi.mocked(organizationsMineList).mockResolvedValue(
      makeListResponse([FIXTURE_MEMBERSHIP_1, FIXTURE_MEMBERSHIP_2])
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useActiveOrganization(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Stale id cleared; multi-org with no valid selection → needsSelection.
    await waitFor(() => expect(result.current.activeOrganizationId).toBeNull());

    expect(result.current.activeMembership).toBeNull();
    expect(result.current.needsSelection).toBe(true);
  });

  // -------------------------------------------------------------------------
  // setActive(id) writes the store AND calls queryClient.invalidateQueries
  // -------------------------------------------------------------------------

  it('setActive writes the store and calls queryClient.invalidateQueries', async () => {
    vi.mocked(organizationsMineList).mockResolvedValue(
      makeListResponse([FIXTURE_MEMBERSHIP_1, FIXTURE_MEMBERSHIP_2])
    );

    const { Wrapper, queryClient } = makeQueryWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useActiveOrganization(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setActive('2');
    });

    expect(getActiveOrganizationId()).toBe('2');
    expect(invalidateSpy).toHaveBeenCalledOnce();
    // invalidateQueries called with no args → flushes all tenant caches
    expect(invalidateSpy).toHaveBeenCalledWith();
  });

  // -------------------------------------------------------------------------
  // enabled:false → query not fired; store not touched
  // -------------------------------------------------------------------------

  it('does not fire mine/ query or touch store when enabled is false', async () => {
    vi.mocked(organizationsMineList).mockResolvedValue(
      makeListResponse([FIXTURE_MEMBERSHIP_1])
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(
      () => useActiveOrganization({ enabled: false }),
      { wrapper: Wrapper }
    );

    // Give effects time to run (they should not).
    await new Promise((r) => setTimeout(r, 30));

    expect(organizationsMineList).not.toHaveBeenCalled();
    expect(result.current.activeOrganizationId).toBeNull();
    expect(result.current.needsSelection).toBe(false);
  });
});
