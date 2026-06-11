import type { PatchedOrganizationWritable } from '@/client';
import { organizationsPartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CURRENT_ORGANIZATION_QUERY_KEY } from '@/hooks/organizations/use-current-organization';
import { useCurrentOrganization } from '@/hooks/organizations/use-current-organization';

// ---------------------------------------------------------------------------
// useRoomsSyncConfig
//
// Reads the current organization's rooms-sync configuration and provides a
// mutation to update it via PATCH /organizations/{id}/.
//
// Configuration fields (from Organization / PatchedOrganizationWritable):
//  - should_sync_rooms (boolean, optional): whether to enable rooms sync
//
// The organization is fetched via useCurrentOrganization; the org id is
// derived from membership.organization.id. On success, invalidates the
// current-organization query so the org reloads with the new config.
//
// Phase 33 ownership: Rooms sync configuration is persisted via the org's
// should_sync_rooms field (no dedicated config endpoint). Trigger (Phase 34)
// is organizationsSyncRoomsCreate.
// ---------------------------------------------------------------------------

export function useRoomsSyncConfig() {
  const queryClient = useQueryClient();
  const { organization, isOnboarded } = useCurrentOrganization();

  const saveConfigMutation = useMutation({
    ...organizationsPartialUpdateMutation(),
    onSuccess: () => {
      // Invalidate the current-organization query so config reloads.
      queryClient.invalidateQueries({
        queryKey: CURRENT_ORGANIZATION_QUERY_KEY,
      });
    },
  });

  const saveRoomsSyncConfig = async (values: PatchedOrganizationWritable) => {
    if (!organization?.id) {
      throw new Error('Organization not loaded');
    }

    return saveConfigMutation.mutateAsync({
      path: { id: String(organization.id) },
      body: values,
    });
  };

  return {
    // Current config state from the org
    shouldSyncRooms: organization?.should_sync_rooms ?? false,
    organizationId: organization?.id,

    // Mutation control: async fn + raw mutation
    saveRoomsSyncConfig,
    saveConfigMutation,

    // Ready flag: whether the org is loaded
    isReady: isOnboarded && organization !== null,
  };
}
