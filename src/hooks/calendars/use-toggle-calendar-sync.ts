import { calendarPartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useToggleCalendarSync
//
// Wraps `calendarPartialUpdate` (PATCH /calendar/{id}/) to flip the
// `sync_enabled` flag. Disabling sync stops new CalendarSyncs (webhook- and
// import-triggered included) for calendars that aren't useful for scheduling —
// holidays, birthdays, org-wide events — so their BlockedTimes stop cluttering
// availability. Previously synced events are left untouched.
//
// On success, invalidates all calendar-list queries (same predicate pattern as
// useDeleteCalendar) so the table reflects the new state.
// ---------------------------------------------------------------------------

export function useToggleCalendarSync() {
  const queryClient = useQueryClient();

  const toggleSyncMutation = useMutation({
    ...calendarPartialUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'calendarList',
      });
    },
  });

  const toggleSync = async (id: number, syncEnabled: boolean) =>
    toggleSyncMutation.mutateAsync({
      path: { id: String(id) },
      body: { sync_enabled: syncEnabled },
    });

  return { toggleSync, toggleSyncMutation };
}
