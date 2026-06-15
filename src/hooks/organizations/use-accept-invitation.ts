import type { AcceptInvitation } from '@/client';
import {
  invitationsAcceptCreateMutation,
  organizationsMineListOptions,
} from '@/client/@tanstack/react-query.gen';
import { setActiveOrganizationId } from '@/lib/active-organization';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CURRENT_ORGANIZATION_QUERY_KEY } from './use-current-organization';
import { MY_ORGANIZATIONS_QUERY_KEY } from './use-my-organizations';

// ---------------------------------------------------------------------------
// Error detection
//
// On 400, the thrown error is the response body. The backend returns:
//   { "error": "User is already a member of this organization." }
// and may also include a DRF code field:
//   { "error": "...", "code": "user_already_has_membership" }
//
// `UserAlreadyHasMembershipError` (same-org duplicate) means the user is
// already a member of THIS specific organization — NOT "one org per user".
// A user in org A CAN accept an invite into org B (that becomes a second
// membership); only re-accepting into the same org triggers this error.
// ---------------------------------------------------------------------------
const ALREADY_MEMBER_MESSAGE = 'User is already a member of this organization.';
const ALREADY_MEMBER_CODE = 'user_already_has_membership';

/**
 * Extract a human-readable message from an accept-invite error.
 *
 * On 400 the thrown error is the response body, e.g.
 * `{ "error": "User is already a member of this organization." }`.
 */
export function getAcceptInvitationErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'error' in error) {
    const message = (error as { error?: unknown }).error;
    if (typeof message === 'string') return message;
  }
  if (error instanceof Error) return error.message;
  return 'Could not accept the invitation.';
}

/**
 * Returns true when the 400 error indicates the user is already a member
 * of THIS organization (same-org duplicate attempt). A user in org A
 * CAN accept an invite into org B — that returns 201, not this error.
 */
export function isAlreadyMemberError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    // Prefer stable DRF code over message string matching.
    if (
      'code' in error &&
      (error as { code?: unknown }).code === ALREADY_MEMBER_CODE
    ) {
      return true;
    }
  }
  return getAcceptInvitationErrorMessage(error) === ALREADY_MEMBER_MESSAGE;
}

/**
 * Accepts an organization invitation by token. On success:
 * - Actively fetches the mine/ list BEFORE accepting (via fetchQuery, which
 *   works regardless of active observers — safe on /auth/accept-invite outside
 *   the (app) group where useMyOrganizations is NOT mounted).
 * - Accepts the invite.
 * - Invalidates MY_ORGANIZATIONS_QUERY_KEY (marks stale) then re-fetches via
 *   fetchQuery so the fresh list is available synchronously before the page
 *   navigates into (app).
 * - Diffs before/after to find the newly-joined org and sets it active so the
 *   next tenant request carries the correct X-Organization-Id.
 * - Invalidates CURRENT_ORGANIZATION_QUERY_KEY for the gated/role state.
 *
 * The 201 body is just { token } — it does NOT return the org id — so we
 * snapshot the before/after mine/ list to find the new membership.
 *
 * Using fetchQuery (not passive invalidate + getQueryData) is critical here:
 * invalidateQueries with no active observer does NOT trigger a refetch, so
 * getQueryData would return stale/undefined and the diff would find no new org.
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const acceptInvitationMutation = useMutation({
    ...invitationsAcceptCreateMutation(),
  });

  const acceptInvitation = async (body: AcceptInvitation) => {
    // Actively fetch the "before" snapshot — works with no active observer.
    const beforeList = await queryClient.fetchQuery(
      organizationsMineListOptions({})
    );
    const before = new Set(
      (beforeList ?? []).map((m) => String(m.organization.id))
    );

    const result = await acceptInvitationMutation.mutateAsync({ body });

    // Mark mine/ stale so the subsequent fetchQuery re-fetches rather than
    // returning the cached pre-accept list.
    await queryClient.invalidateQueries({
      queryKey: MY_ORGANIZATIONS_QUERY_KEY,
    });

    // Re-fetch fresh after invalidation — fetchQuery always fetches when stale.
    const afterList = await queryClient.fetchQuery(
      organizationsMineListOptions({})
    );

    // Diff to detect the newly-joined org.
    const newMemberships = (afterList ?? []).filter(
      (m) => !before.has(String(m.organization.id))
    );

    if (newMemberships.length === 1) {
      // Exactly one new org — switch into it so the next request carries its id.
      setActiveOrganizationId(String(newMemberships[0].organization.id));
    }
    // If none or ambiguous (>1 new), leave selection unchanged. The new org
    // still appears in the switcher via the mine/ invalidation above.

    // Refresh current/ for the gated/role state (fire-and-forget; errors are
    // non-fatal and should not bubble up to the caller).
    queryClient
      .invalidateQueries({ queryKey: CURRENT_ORGANIZATION_QUERY_KEY })
      .catch(() => {});

    return result;
  };

  return { acceptInvitation, acceptInvitationMutation };
}
