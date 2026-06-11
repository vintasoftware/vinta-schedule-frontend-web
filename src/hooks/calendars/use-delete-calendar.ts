import { calendarDestroyMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useDeleteCalendar
//
// Wraps `calendarDestroy` (DELETE /calendar/{id}/) which deletes a calendar.
// On success, invalidates all calendar-list queries using the predicate pattern
// so the table removes the row and active pickers refresh.
//
// Phase 9 ownership: This hook pairs with the Delete row action in
// calendars-table.tsx. It invalidates calendar-list queries using the same
// predicate pattern as useCreateCalendar.
// ---------------------------------------------------------------------------

export function useDeleteCalendar() {
  const queryClient = useQueryClient();

  const deleteCalendarMutation = useMutation({
    ...calendarDestroyMutation(),
    onSuccess: () => {
      // Invalidate all calendar-list queries using predicate form (matches
      // the pattern from useCreateCalendar). This ensures the list refetches
      // and the row is removed, plus active pickers will stop showing it.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'calendarList',
      });
    },
  });

  const deleteCalendar = async (id: number) =>
    deleteCalendarMutation.mutateAsync({
      path: { id: String(id) },
    });

  return { deleteCalendar, deleteCalendarMutation };
}
