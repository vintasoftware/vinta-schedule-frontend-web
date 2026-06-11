import { calendarAdminSyncCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';
import { DateTime } from '@/lib/datetime';

// ---------------------------------------------------------------------------
// useTriggerUserCalendarSync
//
// Wraps `calendarAdminSyncCreate` (POST /calendar/{id}/admin-sync/)
// which allows an admin to trigger a sync of another user's calendar.
//
// Default window: now minus 1 month → now plus 3 months. This captures
// recent history and near-future bookings without requesting the entire
// calendar history. The `should_update_events` flag is set to true to
// keep synced events current.
//
// Phase 35 ownership: This hook pairs with the Sync row action in
// all-calendars-table.tsx. It does not invalidate the calendars list on
// success — sync is fire-and-toast with no live tracking. Admin-only.
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_MONTHS_PAST = 1;
const DEFAULT_WINDOW_MONTHS_FUTURE = 3;

/**
 * Build a default sync window: now minus 1 month → now plus 3 months.
 *
 * Returns an object with ISO datetime strings (including UTC offset) ready
 * to pass to the API.
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

export function useTriggerUserCalendarSync() {
  const triggerUserCalendarSyncMutation = useMutation({
    ...calendarAdminSyncCreateMutation(),
    onSuccess: () => {
      // Fire-and-toast: no cache invalidation. The sync request is asynchronous
      // on the backend; the user sees a "sync started" confirmation toast.
      // No live tracking or follow-up polling.
    },
  });

  const triggerUserCalendarSync = async (calendarId: number) => {
    const window = buildDefaultSyncWindow();
    return triggerUserCalendarSyncMutation.mutateAsync({
      path: { id: String(calendarId) },
      body: {
        start_datetime: window.start_datetime,
        end_datetime: window.end_datetime,
        should_update_events: true,
      },
    });
  };

  return { triggerUserCalendarSync, triggerUserCalendarSyncMutation };
}
