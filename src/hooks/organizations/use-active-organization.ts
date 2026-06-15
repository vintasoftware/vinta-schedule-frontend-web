import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  getActiveOrganizationId,
  setActiveOrganizationId,
  clearActiveOrganization,
  subscribeActiveOrganization,
} from '@/lib/active-organization';
import { useMyOrganizations } from './use-my-organizations';

// ---------------------------------------------------------------------------
// useActiveOrganization
//
// Reads the active-org module store via useSyncExternalStore (SSR-safe; server
// snapshot always returns null), combines it with the caller's membership list
// from useMyOrganizations, and runs a bootstrap effect that:
//
//   1. Clears a stale stored id that is no longer in mine/.
//   2. Auto-selects the single org when the user has exactly 1 membership and
//      nothing is stored.
//   3. Leaves the store unset when the user has 2+ memberships and no valid
//      selection — `needsSelection` will be true so Phase 3b can gate them.
//
// Note on bootstrap vs switch mechanics:
//   - During initial bootstrap the effect calls `setActiveOrganizationId`
//     directly (NOT the exported `setActive`) so there is no unnecessary
//     wholesale query invalidation at first paint (no tenant queries have fired
//     yet against a *previous* org).
//   - `setActive` (returned to callers) calls both `setActiveOrganizationId`
//     AND `queryClient.invalidateQueries()` so a mid-session switch flushes all
//     tenant-scoped caches under the new header.
//
// Render-loop guard: the store's `setActiveOrganizationId` is a no-op when the
// value hasn't changed, so re-renders that re-run the effect don't trigger an
// infinite subscribe→render cycle.
// ---------------------------------------------------------------------------

export function useActiveOrganization({ enabled = true } = {}) {
  const queryClient = useQueryClient();

  // Read the store reactively. The same getter is passed as the server snapshot
  // so SSR always sees null (getActiveOrganizationId guards typeof window).
  const activeOrganizationId = useSyncExternalStore(
    subscribeActiveOrganization,
    getActiveOrganizationId,
    getActiveOrganizationId
  );

  const { memberships, isMultiOrg, isGated, isLoading, isError, query } =
    useMyOrganizations({ enabled });

  // Derive the active membership from the current store value.
  const activeMembership =
    memberships.find(
      (m) => String(m.organization.id) === activeOrganizationId
    ) ?? null;

  // Bootstrap effect: runs once mine/ has resolved (not loading, no error).
  // Guards against loops via the no-op behaviour of setActiveOrganizationId
  // when the value is unchanged.
  useEffect(() => {
    if (!enabled || isLoading || isError) return;

    const storedId = getActiveOrganizationId();
    const storedIsValid =
      storedId !== null &&
      memberships.some((m) => String(m.organization.id) === storedId);

    if (memberships.length === 1) {
      // Single-org user: always land on exactly one store write. A non-null
      // overwrite IS the heal for a stale id — no need to clear first.
      // setActiveOrganizationId is a no-op when the value is already correct,
      // which prevents an infinite subscribe→render cycle.
      const targetId = String(memberships[0].organization.id);
      if (storedId !== targetId) {
        setActiveOrganizationId(targetId);
      }
      return;
    }

    if (storedId !== null && !storedIsValid) {
      // Stale stored id with 2+ memberships (or 0): clear it.
      // 2+ memberships with no valid id → leave unset; needsSelection handles it.
      // 0 memberships (gated) → leave unset (handled by isGated/onboarding gate).
      clearActiveOrganization();
      return;
    }

    // 2+ memberships and no valid selection → leave unset (needsSelection).
    // 0 memberships (gated) → leave unset (handled by isGated/onboarding gate).
    // Valid stored id → no action needed (storedIsValid guard above).
  }, [enabled, isLoading, isError, memberships]);

  // setActive: for mid-session switches. Writes the store and flushes all
  // tenant-scoped caches so queries refetch under the new X-Organization-Id.
  // Memoized so Phase 3b/4 callers can safely put it in effect/callback deps.
  const setActive = useCallback(
    (id: string) => {
      setActiveOrganizationId(id);
      queryClient.invalidateQueries();
    },
    [queryClient]
  );

  // needsSelection: true when an authenticated multi-org user has no valid
  // stored selection after mine/ has resolved. Phase 3b uses this to gate.
  const needsSelection =
    enabled &&
    !isLoading &&
    memberships.length > 1 &&
    activeMembership === null;

  return {
    activeOrganizationId,
    activeMembership,
    memberships,
    isMultiOrg,
    isGated,
    isLoading,
    isError,
    setActive,
    needsSelection,
    query,
  };
}
