import { organizationsMineListOptions } from '@/client/@tanstack/react-query.gen';
import {
  clearActiveOrganization,
  getActiveOrganizationId,
  setActiveOrganizationId,
} from '@/lib/active-organization';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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

// ---------------------------------------------------------------------------
// 403 stale-org error detection
//
// When the stored active org id is no longer valid (e.g. membership was
// deactivated, or the id is stale), a tenant request returns:
//   403 { "detail": "X-Organization-Id header names an organization you are
//         not an active member of." }
//
// This is DISTINCT from the genuine no-membership 403:
//   403 { "detail": "No active organization membership." }
// That one is left for the existing disabled/onboarding handling.
// ---------------------------------------------------------------------------

const STALE_ORG_DETAIL =
  'X-Organization-Id header names an organization you are not an active member of.';

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
 * Returns true when the error body matches the 403 "stale active org" response.
 *
 * This specifically does NOT match "No active organization membership." —
 * that genuinely-no-org 403 is left to the existing disabled/no-access path.
 */
function isStaleOrgError(error: unknown): boolean {
  if (error !== null && typeof error === 'object' && 'detail' in error) {
    return (error as { detail?: unknown }).detail === STALE_ORG_DETAIL;
  }
  return false;
}

/**
 * Safety-net recovery for the 400 "X-Organization-Id header required" error
 * (UC5) and the 403 "stale active org" error (UC6).
 *
 * Both cases are triggered from the global QueryCache onError. Recovery logic:
 *
 * ---- 400 path (UC5) ----
 * 1. Fetch mine/ to get the membership list.
 * 2. LOOP GUARD: if the current selection is already valid in mine/, return
 *    'ignored' — re-setting it would cause an invalidate → refetch → error loop.
 * 3. If mine/ has entries and no valid selection: set the first org active,
 *    invalidate all queries. Return 'recovered-400'.
 * 4. If mine/ is empty: user is gated — onboarding gate handles it. Return 'ignored'.
 *
 * ---- 403 stale-org path (UC6) ----
 * 1. Fetch mine/ to get the current membership list.
 * 2. LOOP GUARD: if the current selection is ALREADY valid in mine/, return
 *    'ignored' — a valid selection shouldn't produce this 403, and re-setting
 *    would loop.
 * 3. If mine/ has entries: set the first org active, invalidate all queries,
 *    toast a neutral message. Return 'recovered-403'.
 * 4. If mine/ is empty: clear the stale selection (so subsequent requests send
 *    no header), return 'ignored'. The onboarding/no-access gate handles it.
 *    Do NOT toast in this case — the user has no orgs left.
 *
 * This function is PURE and testable: no React hooks, no module state beyond
 * what getActiveOrganizationId/setActiveOrganizationId/clearActiveOrganization provide.
 */
export async function recoverFromOrganizationQueryError(
  error: unknown,
  queryClient: QueryClient
): Promise<'recovered-400' | 'recovered-403' | 'ignored'> {
  const is400 = isHeaderRequiredError(error);
  const is403 = isStaleOrgError(error);

  // Step 1: is this an error we handle?
  if (!is400 && !is403) {
    return 'ignored';
  }

  // Step 2: fetch the membership list actively (fetchQuery works regardless
  // of mounted observers — same pattern as Phase 7 in use-accept-invitation.ts).
  const memberships = await queryClient.fetchQuery(
    organizationsMineListOptions({})
  );

  const list = memberships ?? [];

  // Step 3 (LOOP GUARD): check if the current selection is already valid.
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

  if (is400) {
    // Step 4 (400): mine/ has entries and no valid selection — recover.
    if (list.length > 0) {
      setActiveOrganizationId(String(list[0].organization.id));
      await queryClient.invalidateQueries();
      return 'recovered-400';
    }

    // Step 5 (400): mine/ is empty — user is gated; onboarding gate handles this.
    return 'ignored';
  }

  // is403 path (UC6):
  if (list.length > 0) {
    // Step 4 (403): mine/ has entries — re-pick the first org and toast.
    setActiveOrganizationId(String(list[0].organization.id));
    await queryClient.invalidateQueries();
    toast(
      `That organization is no longer available — switched to ${list[0].organization.name}.`
    );
    return 'recovered-403';
  }

  // Step 5 (403): mine/ is empty — clear the stale selection so subsequent
  // requests send no header, then fall through to existing disabled/no-access
  // handling. Do NOT toast (user has no orgs left, redirected elsewhere).
  clearActiveOrganization();
  return 'ignored';
}
