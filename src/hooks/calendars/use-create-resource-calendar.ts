import type { ResourceCalendarCreate } from '@/client';
import { calendarResourceCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useCreateResourceCalendar
//
// Wraps `calendarResourceCreate` (POST /calendar/resource/). Creates an
// internal (manual) resource calendar — a shared bookable resource (room,
// equipment, etc.) owned by the organization. Admin only (enforced by the
// backend).
//
// On success, invalidates all calendar-list queries via the predicate form
// (robust against param-encoded query keys — see use-all-calendars.ts CAVEAT
// comment). Returns both an ergonomic `createResourceCalendar` async fn and the
// raw mutation object so callers can inspect isPending/isError.
// ---------------------------------------------------------------------------

export function useCreateResourceCalendar() {
  const queryClient = useQueryClient();

  const createResourceCalendarMutation = useMutation({
    ...calendarResourceCreateMutation(),
    onSuccess: () => {
      // Invalidate all calendar-list queries (prefix + params variants).
      // Use predicate form for robustness — the no-args key returned by
      // calendarListQueryKey() may not be a true prefix of the per-params
      // keys that hey-api encodes.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'calendarList',
      });
    },
  });

  const createResourceCalendar = async (body: ResourceCalendarCreate) =>
    createResourceCalendarMutation.mutateAsync({ body });

  return { createResourceCalendar, createResourceCalendarMutation };
}
