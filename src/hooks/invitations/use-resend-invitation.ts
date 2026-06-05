import { invitationsResendCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useResendInvitation
//
// Wraps `invitationsResendCreate` (POST /invitations/{id}/resend/) which
// regenerates the invitation token and refreshes the expiry. On success,
// invalidates all invitations queries so the table picks up the updated
// expires_at. The invitation id is passed as a path param when calling
// `resendInvitation(id)`.
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

  const resendInvitation = async (id: number) =>
    resendInvitationMutation.mutateAsync({
      // The resend body field mirrors the invitation writable shape but the
      // endpoint only uses it to re-validate; pass an empty object cast as any
      // since the API doesn't require body fields for resend.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: {} as any,
      path: { id: String(id) },
    });

  return { resendInvitation, resendInvitationMutation };
}
