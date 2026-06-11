import { organizationsSyncRoomsCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';
import { useCurrentOrganization } from '@/hooks/organizations/use-current-organization';

// ---------------------------------------------------------------------------
// useTriggerRoomsSync
//
// Wraps `organizationsSyncRoomsCreate` (POST /organizations/{id}/sync-rooms/)
// which triggers an asynchronous rooms synchronization.
//
// Body construction (OrganizationWritable):
//  - `name` (required): sourced from the current organization.name to satisfy
//    the API's required field. This does not change the org name, merely
//    echoes it in the request body per the API contract.
//  - `should_sync_rooms` (optional): omitted for the trigger. The flag is
//    managed by useRoomsSyncConfig (Phase 33); the trigger itself does not
//    alter config—it fires an async sync job.
//
// Fire-and-toast: no cache invalidation. The sync is asynchronous on the
// backend; the UI shows a toast confirming the sync has started. No live
// tracking or follow-up polling.
//
// Phase 34 ownership: Trigger endpoint and fire-and-toast pattern.
// ---------------------------------------------------------------------------

export function useTriggerRoomsSync() {
  const { organization } = useCurrentOrganization();

  const triggerSyncMutation = useMutation({
    ...organizationsSyncRoomsCreateMutation(),
    onSuccess: () => {
      // Fire-and-toast: no cache invalidation. The sync is async on the backend.
    },
  });

  const triggerRoomsSync = async () => {
    if (!organization?.id || organization.id === null) {
      throw new Error('Organization not loaded');
    }

    const orgName = organization.name;
    if (typeof orgName !== 'string' || orgName.trim() === '') {
      throw new Error('Organization name not available');
    }

    return triggerSyncMutation.mutateAsync({
      path: { id: String(organization.id) },
      body: {
        name: orgName,
      },
    });
  };

  return { triggerRoomsSync, triggerSyncMutation };
}
