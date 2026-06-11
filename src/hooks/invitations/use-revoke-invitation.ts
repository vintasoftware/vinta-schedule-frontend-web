import { invitationsDestroyMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useRevokeInvitation
//
// Wraps `invitationsDestroy` (DELETE /invitations/{id}/) which revokes a
// pending invitation. On success, invalidates all invitations queries so
// the table removes the row.
//
// Phase 5 ownership: This hook pairs with the Revoke row action in
// invitations-table.tsx. It invalidates invitations queries using the same
// predicate pattern as useResendInvitation and useCreateInvitation.
// ---------------------------------------------------------------------------

export function useRevokeInvitation() {
  const queryClient = useQueryClient();

  const revokeInvitationMutation = useMutation({
    ...invitationsDestroyMutation(),
    onSuccess: () => {
      // Invalidate all invitations queries using predicate form (matches
      // the pattern from useCreateInvitation and useResendInvitation).
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'invitationsList',
      });
    },
  });

  const revokeInvitation = async (id: number) =>
    revokeInvitationMutation.mutateAsync({
      path: { id: String(id) },
    });

  return { revokeInvitation, revokeInvitationMutation };
}
