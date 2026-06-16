import { organizationMembersUpdateRoleCreateMutation } from '@/client/@tanstack/react-query.gen';
import type { RoleEnum } from '@/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useUpdateMemberRole
//
// Wraps `organizationMembersUpdateRoleCreate`
// (POST /organization-members/{id}/update-role/) which changes a member's role
// between 'member' and 'admin'. On success, invalidates the team members query
// using the predicate pattern so the member's role badge updates.
//
// Server guards (surfaced as errors to the caller): cannot demote the last
// active admin (400), caller must be an admin (403).
// ---------------------------------------------------------------------------

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  const updateMemberRoleMutation = useMutation({
    ...organizationMembersUpdateRoleCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id ===
            'organizationMembersList',
      });
    },
  });

  const updateMemberRole = async (id: number, role: RoleEnum) =>
    updateMemberRoleMutation.mutateAsync({
      path: { id: String(id) },
      body: { role },
    } as Parameters<typeof updateMemberRoleMutation.mutateAsync>[0]);

  return { updateMemberRole, updateMemberRoleMutation };
}
