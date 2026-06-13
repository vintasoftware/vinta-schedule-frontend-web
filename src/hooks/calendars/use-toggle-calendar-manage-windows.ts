import { calendarPartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useToggleCalendarManageWindows
//
// Wraps `calendarPartialUpdate` (PATCH /calendar/{id}/) to flip the
// `manage_available_windows` flag. When true, the calendar manages its own
// available time windows; when false, it uses the available windows of the
// external calendar it's attached to.
//
// On success, invalidates all calendar-list queries (same predicate pattern as
// useToggleCalendarSync) so the table reflects the new state.
// ---------------------------------------------------------------------------

export function useToggleCalendarManageWindows() {
  const queryClient = useQueryClient();

  const toggleManageWindowsMutation = useMutation({
    ...calendarPartialUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'calendarList',
      });
    },
  });

  const toggleManageWindows = async (id: number, manageWindows: boolean) =>
    toggleManageWindowsMutation.mutateAsync({
      path: { id: String(id) },
      body: { manage_available_windows: manageWindows },
    });

  return { toggleManageWindows, toggleManageWindowsMutation };
}
