import type { OrganizationInvitationWritable } from '@/client';
import { invitationsCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useCreateInvitation
//
// Wraps `invitationsCreate` (POST /invitations/). On success, invalidates all
// invitations queries via the predicate form (robust against param-encoded
// query keys — see use-invitations.ts CAVEAT comment). Returns both an
// ergonomic `createInvitation` async fn and the raw mutation object so
// callers can inspect isPending/isError.
// ---------------------------------------------------------------------------

export function useCreateInvitation() {
  const queryClient = useQueryClient();

  const createInvitationMutation = useMutation({
    ...invitationsCreateMutation(),
    onSuccess: () => {
      // Invalidate all invitations queries (prefix + params variants).
      // Use predicate form for robustness — the no-args key returned by
      // invitationsListQueryKey() may not be a true prefix of the
      // per-params keys that hey-api encodes.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'invitationsList',
      });
    },
  });

  const createInvitation = async (body: OrganizationInvitationWritable) =>
    createInvitationMutation.mutateAsync({ body });

  return { createInvitation, createInvitationMutation };
}
