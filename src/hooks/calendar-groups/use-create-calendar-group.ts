/**
 * useCreateCalendarGroup — create a new Calendar Group.
 *
 * Wraps `calendarGroupsCreate` (POST /calendar-groups/). On success, invalidates
 * the calendar-groups list via the predicate form so that any parameterised
 * list queries (paginated, searched) are also busted.
 *
 * Body shape (CalendarGroupWritable):
 *   {
 *     name: string;          // required
 *     description?: string;  // optional
 *     slots: Array<{
 *       name: string;          // required
 *       description?: string;  // optional
 *       order?: number;        // optional — display order
 *       required_count?: number; // default 1 on backend
 *       calendar_ids: number[]; // IDs of candidate calendars for this slot
 *     }>;
 *   }
 *
 * Returns both an ergonomic `createCalendarGroup` async fn and the raw mutation
 * object so callers can inspect `isPending`/`isError`.
 */

import type { CalendarGroupWritable } from '@/client';
import { calendarGroupsCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateCalendarGroup() {
  const queryClient = useQueryClient();

  const createCalendarGroupMutation = useMutation({
    ...calendarGroupsCreateMutation(),
    onSuccess: () => {
      // Invalidate all calendar-groups list queries (prefix + params variants).
      // Use predicate form for robustness — the no-args key returned by
      // calendarGroupsListQueryKey() may not be a true prefix of the
      // per-params keys that hey-api encodes.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'calendarGroupsList',
      });
    },
  });

  const createCalendarGroup = async (body: CalendarGroupWritable) =>
    createCalendarGroupMutation.mutateAsync({ body });

  return { createCalendarGroup, createCalendarGroupMutation };
}
