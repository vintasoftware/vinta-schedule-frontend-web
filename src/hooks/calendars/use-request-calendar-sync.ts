import { calendarRequestSyncCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';
import { DateTime } from '@/lib/datetime';

// ---------------------------------------------------------------------------
// useRequestCalendarSync
//
// Wraps `calendarRequestSyncCreate` (POST /calendar/{id}/request-sync/)
// which triggers a calendar synchronization over a default date range.
//
// Default window: now minus 1 month → now plus 3 months. This captures
// recent history and near-future bookings without requesting the entire
// calendar history. The `should_update_events` flag is set to true to
// keep synced events current.
//
// Phase 10 ownership: This hook pairs with the Sync row action in
// calendars-table.tsx. It does not invalidate the calendars list on
// success — sync is fire-and-toast with no live tracking.
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

export function useRequestCalendarSync() {
  const requestSyncMutation = useMutation({
    ...calendarRequestSyncCreateMutation(),
    onSuccess: () => {
      // Fire-and-toast: no cache invalidation. The sync request is asynchronous
      // on the backend; the user sees a "sync started" confirmation toast.
      // No live tracking or follow-up polling.
    },
  });

  const requestSync = async (calendarId: number) => {
    const window = buildDefaultSyncWindow();
    return requestSyncMutation.mutateAsync({
      path: { id: String(calendarId) },
      body: {
        start_datetime: window.start_datetime,
        end_datetime: window.end_datetime,
        should_update_events: true,
      },
    });
  };

  return { requestSync, requestSyncMutation };
}
