import type { CalendarWritable } from '@/client';
import { calendarCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useCreateCalendar
//
// Wraps `calendarCreate` (POST /calendar/). On success, invalidates all
// calendar-list queries via the predicate form (robust against param-encoded
// query keys — see use-my-calendars.ts CAVEAT comment). Returns both an
// ergonomic `createCalendar` async fn and the raw mutation object so
// callers can inspect isPending/isError.
// ---------------------------------------------------------------------------

export function useCreateCalendar() {
  const queryClient = useQueryClient();

  const createCalendarMutation = useMutation({
    ...calendarCreateMutation(),
    onSuccess: () => {
      // Invalidate all calendar-list queries (prefix + params variants).
      // Use predicate form for robustness — the no-args key returned by
      // calendarListQueryKey() may not be a true prefix of the
      // per-params keys that hey-api encodes.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'calendarList',
      });
    },
  });

  const createCalendar = async (body: CalendarWritable) =>
    createCalendarMutation.mutateAsync({ body });

  return { createCalendar, createCalendarMutation };
}
