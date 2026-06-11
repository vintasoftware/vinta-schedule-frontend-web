import {
  organizationMembersDeactivateCreateMutation,
  organizationMembersReactivateCreateMutation,
} from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useDisableUser
//
// Wraps `organizationMembersDeactivateCreate` (POST /organization-members/{id}/deactivate/)
// which disables a member. On success, invalidates the team members query using the
// predicate pattern so the member's status updates to 'disabled'.
//
// The deactivate op takes an optional body (OrganizationMembership), but since we're
// only changing the is_active flag server-side, we send an empty object to satisfy
// the type system without requiring a full payload.
// ---------------------------------------------------------------------------

export function useDisableUser() {
  const queryClient = useQueryClient();

  const disableUserMutation = useMutation({
    ...organizationMembersDeactivateCreateMutation(),
    onSuccess: () => {
      // Invalidate all team members queries using predicate form (matches
      // the pattern from other team mutations). This reflects the status change.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id ===
            'organizationMembersList',
      });
    },
  });

  const disableUser = async (id: number) =>
    disableUserMutation.mutateAsync({
      path: { id: String(id) },
    } as Parameters<typeof disableUserMutation.mutateAsync>[0]);

  return { disableUser, disableUserMutation };
}

// ---------------------------------------------------------------------------
// useReactivateUser
//
// Wraps `organizationMembersReactivateCreate` (POST /organization-members/{id}/reactivate/)
// which re-enables a disabled member. On success, invalidates the team members query
// so the member's status updates back to 'active'.
// ---------------------------------------------------------------------------

export function useReactivateUser() {
  const queryClient = useQueryClient();

  const reactivateUserMutation = useMutation({
    ...organizationMembersReactivateCreateMutation(),
    onSuccess: () => {
      // Invalidate all team members queries using the same predicate pattern.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id ===
            'organizationMembersList',
      });
    },
  });

  const reactivateUser = async (id: number) =>
    reactivateUserMutation.mutateAsync({
      path: { id: String(id) },
    } as Parameters<typeof reactivateUserMutation.mutateAsync>[0]);

  return { reactivateUser, reactivateUserMutation };
}
