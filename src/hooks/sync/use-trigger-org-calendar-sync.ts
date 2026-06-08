import {
  calendarRequestImportCreateMutation,
  organizationsSyncCalendarsCreateMutation,
} from '@/client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';
import { DateTime } from '@/lib/datetime';
import { useCurrentOrganization } from '@/hooks/organizations/use-current-organization';

// ---------------------------------------------------------------------------
// useTriggerOrgCalendarSync
//
// Two-step org calendar sync, run sequentially:
//  1. `calendarRequestImportCreate` (POST /calendar/request-import/) — enqueue
//     an import of the authenticated user's external calendars. Body
//     (CalendarWritable) requires `name`, so we echo the current org name to
//     satisfy the contract (the import does not create a calendar with it).
//  2. `organizationsSyncCalendarsCreate` (POST /organizations/{id}/sync-calendars/)
//     — enqueue a sync of all org calendars over a default window
//     (now−1mo → +3mo, should_update_events:true), matching the horizon used in
//     use-trigger-user-calendar-sync.ts.
//
// Step 2 only runs after step 1 resolves. Fire-and-toast: no cache
// invalidation; both jobs are asynchronous on the backend.
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_MONTHS_PAST = 1;
const DEFAULT_WINDOW_MONTHS_FUTURE = 3;

/**
 * Build a default sync window: now minus 1 month → now plus 3 months.
 * Mirrors the helper in use-trigger-user-calendar-sync.ts.
 */
function buildDefaultSyncWindow(): {
  start_datetime: string;
  end_datetime: string;
} {
  const now = DateTime.now();
  const start = now
    .minus({ months: DEFAULT_WINDOW_MONTHS_PAST })
    .startOf('day');
  const end = now.plus({ months: DEFAULT_WINDOW_MONTHS_FUTURE }).endOf('day');

  return {
    start_datetime: start.toISO()!,
    end_datetime: end.toISO()!,
  };
}

export function useTriggerOrgCalendarSync() {
  const { organization } = useCurrentOrganization();

  const requestImportMutation = useMutation({
    ...calendarRequestImportCreateMutation(),
  });
  const syncCalendarsMutation = useMutation({
    ...organizationsSyncCalendarsCreateMutation(),
  });

  const triggerOrgCalendarSync = async () => {
    const orgId = organization?.id;
    const orgName = organization?.name;
    if (orgId == null || typeof orgName !== 'string' || orgName.trim() === '') {
      throw new Error('Organization not loaded');
    }

    // Step 1: request import of the user's external calendars.
    await requestImportMutation.mutateAsync({
      body: { name: orgName },
    });

    // Step 2: only after the import request succeeds, enqueue the org-wide sync.
    const window = buildDefaultSyncWindow();
    return syncCalendarsMutation.mutateAsync({
      path: { id: String(orgId) },
      body: {
        start_datetime: window.start_datetime,
        end_datetime: window.end_datetime,
        should_update_events: true,
      },
    });
  };

  const isPending =
    requestImportMutation.isPending || syncCalendarsMutation.isPending;

  return {
    triggerOrgCalendarSync,
    requestImportMutation,
    syncCalendarsMutation,
    isPending,
  };
}
