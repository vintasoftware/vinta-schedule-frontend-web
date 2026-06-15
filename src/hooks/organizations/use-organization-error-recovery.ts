import { organizationsMineListOptions } from '@/client/@tanstack/react-query.gen';
import {
  getActiveOrganizationId,
  setActiveOrganizationId,
} from '@/lib/active-organization';
import type { QueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// 400 header-required error detection
//
// When a multi-org user makes a tenant request WITHOUT X-Organization-Id,
// the backend returns:
//   400 { "detail": "X-Organization-Id header required." }
//
// This should be near-unreachable after Phase 3 bootstrap (which primes the
// header at login time), so this function is a safety-net. Recovery = pick
// the first org from mine/ and invalidate all queries so they refetch with
// the header.
// ---------------------------------------------------------------------------

const HEADER_REQUIRED_DETAIL = 'X-Organization-Id header required.';

/**
 * Returns true when the error body matches the 400 "header required" response.
 *
 * The generated client throws the parsed response body on HTTP errors, so
 * `error` here is the parsed JSON object: `{ "detail": "..." }`.
 */
function isHeaderRequiredError(error: unknown): boolean {
  if (error !== null && typeof error === 'object' && 'detail' in error) {
    return (error as { detail?: unknown }).detail === HEADER_REQUIRED_DETAIL;
  }
  return false;
}

/**
 * Safety-net recovery for the 400 "X-Organization-Id header required" error.
 *
 * Use-case UC5: triggered from the global QueryCache onError when a tenant
 * request fires without a selection (near-unreachable after Phase 3 bootstrap).
 *
 * Recovery logic:
 * 1. If the error is not the header-required 400, return 'ignored'.
 * 2. LOOP GUARD: if there is already a valid active selection (it appears in
 *    mine/), return 'ignored' — re-setting it would not help and would create
 *    an invalidate → refetch → error loop.
 * 3. Fetch mine/ to get the membership list.
 * 4. If mine/ has ≥1 entry and no valid selection exists: set the first org
 *    active and invalidate all queries so they refetch with the header.
 *    Return 'recovered-400'.
 * 5. If mine/ is empty: the user is gated — the onboarding gate (Phase 6)
 *    handles this case. Do nothing. Return 'ignored'.
 *
 * This function is PURE and testable: no React hooks, no module state beyond
 * what getActiveOrganizationId/setActiveOrganizationId provide.
 */
export async function recoverFromOrganizationQueryError(
  error: unknown,
  queryClient: QueryClient
): Promise<'recovered-400' | 'ignored'> {
  // Step 1: is this the header-required 400?
  if (!isHeaderRequiredError(error)) {
    return 'ignored';
  }

  // Step 3: fetch the membership list actively (fetchQuery works regardless
  // of mounted observers — same pattern as Phase 7 in use-accept-invitation.ts).
  const memberships = await queryClient.fetchQuery(
    organizationsMineListOptions({})
  );

  const list = memberships ?? [];

  // Step 2 (LOOP GUARD): check if the current selection is already valid.
  // We fetch mine/ first so we can check membership in a single network call.
  const currentId = getActiveOrganizationId();
  if (currentId !== null) {
    const isValidSelection = list.some(
      (m) => String(m.organization.id) === currentId
    );
    if (isValidSelection) {
      // A valid selection already exists — re-setting it wouldn't fix anything
      // and would cause an infinite invalidate→refetch→error loop.
      return 'ignored';
    }
  }

  // Step 4: mine/ has entries and no valid selection — recover.
  if (list.length >= 1) {
    setActiveOrganizationId(String(list[0].organization.id));
    await queryClient.invalidateQueries();
    return 'recovered-400';
  }

  // Step 5: mine/ is empty — user is gated; onboarding gate handles this.
  return 'ignored';
}
