import { invitationsResendCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useResendInvitation
//
// Wraps `invitationsResendCreate` (POST /invitations/{id}/resend/) which
// regenerates the invitation token and refreshes the expiry. On success,
// invalidates all invitations queries so the table picks up the updated
// expires_at.
//
// The API endpoint requires a body of OrganizationInvitationWritable (email is
// the only required field). Callers must pass the email of the invitation being
// resent so the request body is valid.
//
// Phase 4 ownership note: This hook was stubbed here in Phase 3 to support
// the duplicate-email Resend action inside the InviteMemberDialog. Phase 4
// (Resend an invitation) owns the table-row Resend action and may expand this
// hook (e.g. add debounce/toast orchestration directly in the hook). Phase 4
// should import and extend this hook rather than creating a second file.
// ---------------------------------------------------------------------------

export function useResendInvitation() {
  const queryClient = useQueryClient();

  const resendInvitationMutation = useMutation({
    ...invitationsResendCreateMutation(),
    onSuccess: () => {
      // Invalidate all invitations queries — same predicate pattern as
      // useCreateInvitation for robustness.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'invitationsList',
      });
    },
  });

  // `email` is required by OrganizationInvitationWritable (the only required
  // field on that type). The resend endpoint re-validates the body before
  // regenerating the token, so an empty body would 400.
  const resendInvitation = async (id: number, email: string) =>
    resendInvitationMutation.mutateAsync({
      body: { email },
      path: { id: String(id) },
    });

  return { resendInvitation, resendInvitationMutation };
}
