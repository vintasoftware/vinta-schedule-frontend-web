import { calendarDestroyMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useDeleteBundle
//
// Wraps `calendarDestroy` (DELETE /calendar/{id}/) which deletes a bundle.
// A bundle is a calendar with calendar_type === 'bundle', so it uses the same
// destroy endpoint as calendars. On success, invalidates all calendar-list
// queries using the predicate pattern so the table removes the row and any
// active pickers refresh.
//
// Phase 32 ownership: This hook pairs with the Delete row action in
// bundles-table.tsx. It invalidates calendar-list queries using the same
// predicate pattern as useCreateBundle and useUpdateBundle.
// ---------------------------------------------------------------------------

export function useDeleteBundle() {
  const queryClient = useQueryClient();

  const deleteBundleMutation = useMutation({
    ...calendarDestroyMutation(),
    onSuccess: () => {
      // Invalidate all calendar-list queries using predicate form (matches
      // the pattern from useCreateBundle and useUpdateBundle). This ensures
      // the list refetches and the row is removed, plus active pickers will
      // stop showing it.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'calendarList',
      });
    },
  });

  const deleteBundle = async (id: number) =>
    deleteBundleMutation.mutateAsync({
      path: { id: String(id) },
    });

  return { deleteBundle, deleteBundleMutation };
}
