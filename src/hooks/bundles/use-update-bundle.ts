/**
 * useUpdateBundle — update a Calendar Bundle's children and primary calendar.
 *
 * Wraps `calendarBundlePartialUpdate` (PATCH /calendar/{id}/bundle/). On success,
 * invalidates the all-calendars list via predicate form so that any parameterised
 * list queries (paginated, searched) are also busted.
 *
 * IMPORTANT: the patch body does NOT include a `name` field. The API only supports
 * updating `bundle_calendars` and `primary_calendar`. Name editing is not available
 * via this operation.
 *
 * Body shape (PatchedCalendarBundleUpdate):
 *   {
 *     bundle_calendars?: number[];       // optional — child calendar IDs
 *     primary_calendar?: number | null;  // optional — ID of the primary calendar
 *   }
 *
 * Returns both an ergonomic `updateBundle` async fn and the raw mutation
 * object so callers can inspect `isPending`/`isError`.
 */

import type { PatchedCalendarBundleUpdate } from '@/client';
import { calendarBundlePartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useUpdateBundle() {
  const queryClient = useQueryClient();

  const updateBundleMutation = useMutation({
    ...calendarBundlePartialUpdateMutation(),
    onSuccess: () => {
      // Invalidate all calendars list queries (includes bundles fetched from
      // the all-calendars endpoint). Use predicate form for robustness.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'calendarList',
      });
    },
  });

  const updateBundle = async (
    bundleId: number | string,
    body: PatchedCalendarBundleUpdate
  ) =>
    updateBundleMutation.mutateAsync({
      path: { id: String(bundleId) },
      body,
    });

  return { updateBundle, updateBundleMutation };
}
