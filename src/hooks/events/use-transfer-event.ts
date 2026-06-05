/**
 * useTransferEvent — transfer a calendar event to another user's calendar (admin-only).
 *
 * Wraps `calendarEventsTransferCreate` (POST /calendar-events/{id}/transfer/)
 * and sends the destination calendar ID in the request body.
 *
 * Request body shape:
 *   { destination_calendar_id: number }
 *
 * On success the calendar-events queries are invalidated via the predicate-based
 * `invalidateCalendarEvents` helper so both source and destination calendars
 * reflect the change without a hard reload.
 *
 * Admin-only operation — gate this hook via RoleGate in the UI.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarEventsTransferCreateMutation } from '@/client/@tanstack/react-query.gen';
import { invalidateCalendarEvents } from './use-calendar-events';

// ---------------------------------------------------------------------------
// useTransferEvent
// ---------------------------------------------------------------------------

export function useTransferEvent() {
  const queryClient = useQueryClient();

  const transferEventMutation = useMutation({
    ...calendarEventsTransferCreateMutation(),
    onSuccess: async () => {
      await invalidateCalendarEvents(queryClient);
    },
  });

  /**
   * Transfer an event to another calendar.
   *
   * @param eventId - The numeric event id (path parameter).
   * @param destinationCalendarId - The numeric destination calendar id.
   */
  const transferEvent = async (
    eventId: number,
    destinationCalendarId: number
  ) =>
    transferEventMutation.mutateAsync({
      path: { id: String(eventId) },
      body: {
        destination_calendar_id: destinationCalendarId,
      },
    });

  return { transferEvent, transferEventMutation };
}
