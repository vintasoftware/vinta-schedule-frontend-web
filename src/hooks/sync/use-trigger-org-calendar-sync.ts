import { calendarRequestImportCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';
import { useCurrentOrganization } from '@/hooks/organizations/use-current-organization';

// ---------------------------------------------------------------------------
// useTriggerOrgCalendarSync
//
// Single-step org calendar sync:
//  - `calendarRequestImportCreate` (POST /calendar/request-import/) enqueues an
//    import of the authenticated user's external calendars. The import already
//    syncs every calendar by default (it carries a flag to skip syncing, which
//    we leave unset), so no separate organizations/{id}/sync-calendars call is
//    needed. Body (Calendar) requires `name`, so we echo the current org name to
//    satisfy the contract (the import does not create a calendar with it).
//
// Fire-and-toast: no cache invalidation; the import job is asynchronous on the
// backend.
// ---------------------------------------------------------------------------

export function useTriggerOrgCalendarSync() {
  const { organization } = useCurrentOrganization();

  const requestImportMutation = useMutation({
    ...calendarRequestImportCreateMutation(),
  });

  const triggerOrgCalendarSync = async () => {
    const orgName = organization?.name;
    if (typeof orgName !== 'string' || orgName.trim() === '') {
      throw new Error('Organization not loaded');
    }

    // Request import of the user's external calendars — syncs them by default.
    return requestImportMutation.mutateAsync({
      body: { name: orgName },
    });
  };

  return {
    triggerOrgCalendarSync,
    requestImportMutation,
    isPending: requestImportMutation.isPending,
  };
}
