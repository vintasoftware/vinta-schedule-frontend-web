/**
 * useCreateBundle — create a new Calendar Bundle.
 *
 * Wraps `calendarBundleCreate` (POST /calendar/bundle/). On success, invalidates
 * the all-calendars list via predicate form so that any parameterised list queries
 * (paginated, searched) are also busted.
 *
 * Body shape (CalendarBundleCreate):
 *   {
 *     name: string;              // required — bundle name
 *     bundle_calendars: number[]; // required — child calendar IDs (≥1)
 *     primary_calendar: number;   // required — ID of the primary calendar (must ∈ bundle_calendars)
 *   }
 *
 * Returns both an ergonomic `createBundle` async fn and the raw mutation
 * object so callers can inspect `isPending`/`isError`.
 */

import type { CalendarBundleCreate } from '@/client';
import { calendarBundleCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateBundle() {
  const queryClient = useQueryClient();

  const createBundleMutation = useMutation({
    ...calendarBundleCreateMutation(),
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

  const createBundle = async (body: CalendarBundleCreate) =>
    createBundleMutation.mutateAsync({ body });

  return { createBundle, createBundleMutation };
}
