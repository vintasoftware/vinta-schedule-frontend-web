/**
 * useUpdateAttendees — update all three attendee arrays on a calendar event.
 *
 * Wraps `calendarEventsPartialUpdate` (PATCH /calendar-events/{id}/) and sends
 * the **complete** desired arrays for each attendance kind. The backend replaces
 * the stored arrays wholesale on every PATCH (it is not a delta/append call),
 * so callers must send the full list of attendees they want after the update —
 * not just the added/removed delta.
 *
 * On success the calendar-events queries are invalidated via the predicate-based
 * `invalidateCalendarEvents` helper so the calendar view reflects the change
 * without a hard reload.
 *
 * Attendance field shapes (required fields, PATCH-replaces arrays):
 *  - `attendances`:           [{ user_id: number, id?: number | null }]
 *  - `external_attendances`:  [{ external_attendee: { email: string, name?: string, id?: number | null }, id?: number | null }]
 *  - `resource_allocations`:  [{ calendar: number, id?: number | null }]
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarEventsPartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import type {
  EventAttendanceWritable,
  EventExternalAttendanceWritable,
  ResourceAllocationWritable,
} from '@/client';
import { invalidateCalendarEvents } from './use-calendar-events';

// ---------------------------------------------------------------------------
// AttendeeUpdatePayload
// ---------------------------------------------------------------------------

export interface AttendeeUpdatePayload {
  /** Full desired list of internal attendees after the update. */
  attendances: EventAttendanceWritable[];
  /** Full desired list of external attendees after the update. */
  external_attendances: EventExternalAttendanceWritable[];
  /** Full desired list of resource allocations after the update. */
  resource_allocations: ResourceAllocationWritable[];
}

// ---------------------------------------------------------------------------
// useUpdateAttendees
// ---------------------------------------------------------------------------

export function useUpdateAttendees() {
  const queryClient = useQueryClient();

  const updateAttendeesMutation = useMutation({
    ...calendarEventsPartialUpdateMutation(),
    onSuccess: async () => {
      await invalidateCalendarEvents(queryClient);
    },
  });

  /**
   * Update the attendance arrays on an event.
   *
   * @param eventId - The numeric event id (path parameter).
   * @param payload - The complete desired attendance arrays (replace-semantics).
   */
  const updateAttendees = async (
    eventId: number,
    payload: AttendeeUpdatePayload
  ) =>
    updateAttendeesMutation.mutateAsync({
      path: { id: String(eventId) },
      body: {
        attendances: payload.attendances,
        external_attendances: payload.external_attendances,
        resource_allocations: payload.resource_allocations,
      },
    });

  return { updateAttendees, updateAttendeesMutation };
}
