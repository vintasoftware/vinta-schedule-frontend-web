import { organizationsSyncCalendarsCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';
import { DateTime } from '@/lib/datetime';
import { useCurrentOrganization } from '@/hooks/organizations/use-current-organization';

// ---------------------------------------------------------------------------
// useTriggerOrgCalendarSync
//
// Wraps `organizationsSyncCalendarsCreate`
// (POST /organizations/{id}/sync-calendars/) which triggers an asynchronous
// sync of ALL active calendars in the organization.
//
// Default window: now minus 1 month → now plus 3 months. This matches the
// window used in useTriggerUserCalendarSync (use-trigger-user-calendar-sync.ts)
// so all admin sync actions share the same temporal horizon.
//
// Org id is sourced from useCurrentOrganization. The mutation is fire-and-toast:
// no cache invalidation because the sync is asynchronous on the backend.
//
// Admin-only: the API returns 403 for non-admins.
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_MONTHS_PAST = 1;
const DEFAULT_WINDOW_MONTHS_FUTURE = 3;

/**
 * Build a default sync window: now minus 1 month → now plus 3 months.
 *
 * Returns an object with ISO datetime strings (including UTC offset) ready
 * to pass to the API. Mirrors the helper in use-trigger-user-calendar-sync.ts.
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

  const triggerOrgCalendarSyncMutation = useMutation({
    ...organizationsSyncCalendarsCreateMutation(),
    onSuccess: () => {
      // Fire-and-toast: no cache invalidation. The sync is async on the backend.
    },
  });

  const triggerOrgCalendarSync = async () => {
    if (!organization?.id || organization.id === null) {
      throw new Error('Organization not loaded');
    }

    const window = buildDefaultSyncWindow();
    return triggerOrgCalendarSyncMutation.mutateAsync({
      path: { id: String(organization.id) },
      body: {
        start_datetime: window.start_datetime,
        end_datetime: window.end_datetime,
        should_update_events: true,
      },
    });
  };

  return { triggerOrgCalendarSync, triggerOrgCalendarSyncMutation };
}
