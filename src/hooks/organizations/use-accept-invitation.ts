import type { AcceptInvitation } from '@/client';
import { invitationsAcceptCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CURRENT_ORGANIZATION_QUERY_KEY } from './use-current-organization';

// The accept-invite endpoint returns 400 with this body when the user already
// belongs to an organization (one-org-per-user is enforced).
const ALREADY_MEMBER_MESSAGE = 'User already belongs to an organization.';

/**
 * Extract a human-readable message from an accept-invite error.
 *
 * On 400 the thrown error is the response body, e.g.
 * `{ "error": "User already belongs to an organization." }`.
 */
export function getAcceptInvitationErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'error' in error) {
    const message = (error as { error?: unknown }).error;
    if (typeof message === 'string') return message;
  }
  if (error instanceof Error) return error.message;
  return 'Could not accept the invitation.';
}

export function isAlreadyMemberError(error: unknown): boolean {
  return getAcceptInvitationErrorMessage(error) === ALREADY_MEMBER_MESSAGE;
}

/**
 * Accepts an organization invitation by token. On success the user becomes a
 * MEMBER, so we refresh the gated/current-org state.
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const acceptInvitationMutation = useMutation({
    ...invitationsAcceptCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CURRENT_ORGANIZATION_QUERY_KEY,
      });
    },
  });

  const acceptInvitation = async (body: AcceptInvitation) =>
    acceptInvitationMutation.mutateAsync({ body });

  return { acceptInvitation, acceptInvitationMutation };
}
