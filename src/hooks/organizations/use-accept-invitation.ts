import type { AcceptInvitation, MyMembership } from '@/client';
import { invitationsAcceptCreateMutation } from '@/client/@tanstack/react-query.gen';
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
 * - Invalidates MY_ORGANIZATIONS_QUERY_KEY so the switcher shows the new org.
 * - Invalidates CURRENT_ORGANIZATION_QUERY_KEY so current/org state refreshes.
 * - Performs a cache-diff to detect the newly-joined org and sets it as
 *   active, so the next tenant request carries the correct X-Organization-Id.
 *
 * The 201 body is just { token } — it does NOT return the org id — so we
 * snapshot the before/after mine/ list to find the new membership.
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const acceptInvitationMutation = useMutation({
    ...invitationsAcceptCreateMutation(),
  });

  const acceptInvitation = async (body: AcceptInvitation) => {
    // Snapshot org ids before accepting so we can diff after.
    const before = new Set(
      (
        (queryClient.getQueryData(MY_ORGANIZATIONS_QUERY_KEY) as
          | MyMembership[]
          | undefined) ?? []
      ).map((m) => String(m.organization.id))
    );

    const result = await acceptInvitationMutation.mutateAsync({ body });

    // Invalidate mine/ first (await so we get the fresh list for the diff).
    await queryClient.invalidateQueries({
      queryKey: MY_ORGANIZATIONS_QUERY_KEY,
    });

    // Invalidate current/ (fire-and-forget; we don't need to await this).
    void queryClient.invalidateQueries({
      queryKey: CURRENT_ORGANIZATION_QUERY_KEY,
    });

    // Diff the fresh mine/ list to find the newly-joined org.
    const after =
      (queryClient.getQueryData(MY_ORGANIZATIONS_QUERY_KEY) as
        | MyMembership[]
        | undefined) ?? [];
    const newMemberships = after.filter(
      (m) => !before.has(String(m.organization.id))
    );

    if (newMemberships.length === 1) {
      // Exactly one new org — switch into it so the next request carries its id.
      setActiveOrganizationId(String(newMemberships[0].organization.id));
    }
    // If none or ambiguous, leave the selection unchanged. The new org still
    // appears in the switcher via the mine/ invalidation above.

    return result;
  };

  return { acceptInvitation, acceptInvitationMutation };
}
