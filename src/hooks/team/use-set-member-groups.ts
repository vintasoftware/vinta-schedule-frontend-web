import { organizationMembersGroupsCreateMutation } from '@/client/@tanstack/react-query.gen';
import type { GroupsEnum } from '@/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useSetMemberGroups
//
// Wraps `organizationMembersGroupsCreate`
// (POST /organization-members/{user_id}/groups/), which replaces a member's
// groups — and with them the capabilities they hold. This is the endpoint that
// replaced the removed `update-role` action: the request names *groups* (the
// natural input when assigning one) and the 200 response reports the resulting
// membership, including the `permissions` the write produced.
//
// The list REPLACES the member's current groups; it is not additive. On success
// we invalidate the team members query using the predicate pattern so the
// member's standing badge updates.
//
// Server guards (surfaced as errors to the caller): the organization must keep
// at least one member who can manage members (400), and the caller must hold
// `organizations.manage_members` (403).
// ---------------------------------------------------------------------------

export function useSetMemberGroups() {
  const queryClient = useQueryClient();

  const setMemberGroupsMutation = useMutation({
    ...organizationMembersGroupsCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id ===
            'organizationMembersList',
      });
    },
  });

  const setMemberGroups = async (id: number, groups: GroupsEnum[]) =>
    setMemberGroupsMutation.mutateAsync({
      path: { user_id: String(id) },
      body: { groups },
    });

  return { setMemberGroups, setMemberGroupsMutation };
}
