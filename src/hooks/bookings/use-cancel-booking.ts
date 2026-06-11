/**
 * useCancelBooking — cancel a calendar event (single, recurrence-exception, or series).
 *
 * Scope → operation mapping:
 *
 *   Non-recurring event:
 *     calendarEventsDestroy(id)
 *     → DELETE /calendar-events/{id}/
 *     Destroys the event. The backend cascades the deletion to any co-booked
 *     blocked-times associated with this event (backend-cascade assumption —
 *     see note below).
 *
 *   Recurring event, scope = 'this':
 *     calendarEventsCreateExceptionCreate(id, { exception_date, is_cancelled: true })
 *     → POST /calendar-events/{id}/create-exception/
 *     Creates a cancellation exception for the specific occurrence identified by
 *     `event.recurrenceId` (the event's own `recurrence_id` field). The parent
 *     series survives; only this occurrence is cancelled.
 *
 *   Recurring event, scope = 'following':
 *     calendarEventsBulkModifyCreate(id, {
 *       modification_start_date: <start of this occurrence>,
 *       is_cancelled: true,
 *     })
 *     → POST /calendar-events/{id}/bulk-modify/
 *     Marks the occurrence and all future occurrences as cancelled by passing
 *     `is_cancelled: true` on the bulk-modify body. The `modification_start_date`
 *     is the ISO date string of this occurrence's start_time.
 *
 *   Recurring event, scope = 'all':
 *     calendarEventsDestroy(id)
 *     → DELETE /calendar-events/{id}/
 *     Destroys the entire series (same op as non-recurring). All occurrences and
 *     their exceptions are removed by the backend.
 *
 * Co-booked blocked-times release:
 *   The backend is assumed to cascade deletion of co-booked blocked-times when the
 *   parent calendar event is destroyed or its occurrences are cancelled. This mirrors
 *   the pattern used in useCreateBooking where blocked-times are created alongside
 *   the event. If the backend does NOT cascade, the blocked-times will become orphaned;
 *   in that case, a follow-up phase should explicitly delete them here. For now,
 *   we rely on backend cascade and document it.
 *
 * Cache invalidation:
 *   On success: invalidateCalendarEvents(queryClient) — refreshes all calendar views.
 */

import { useQueryClient } from '@tanstack/react-query';
import {
  calendarEventsDestroy,
  calendarEventsCreateExceptionCreate,
  calendarEventsBulkModifyCreate,
} from '@/client/sdk.gen';
import { invalidateCalendarEvents } from '@/hooks/events/use-calendar-events';
import type { CalendarEventVM } from '@/components/calendar/event-vm';
import type { RecurringScope } from '@/components/bookings/scope-prompt-dialog';

// ---------------------------------------------------------------------------
// useCancelBooking
// ---------------------------------------------------------------------------

export function useCancelBooking() {
  const queryClient = useQueryClient();

  /**
   * Cancel the given event.
   *
   * @param event  The CalendarEventVM to cancel (must have `_raw.id`).
   * @param scope  Required when `event.isRecurring` is true. Ignored for
   *               non-recurring events. Defaults to 'all' for safety when
   *               accidentally omitted on a recurring event.
   */
  const cancelBooking = async (
    event: CalendarEventVM,
    scope?: RecurringScope
  ): Promise<void> => {
    const id = String(event._raw.id);

    if (!event.isRecurring) {
      // Non-recurring: destroy the event directly.
      await calendarEventsDestroy({ path: { id } });
    } else {
      // Recurring: apply the chosen scope.
      const resolvedScope: RecurringScope = scope ?? 'all';

      switch (resolvedScope) {
        case 'this': {
          // Cancel only this occurrence via a cancellation exception.
          // The exception_date is the ISO date of the occurrence's start_time
          // (date-only portion, consistent with the API's recurrence_id format).
          const exceptionDate = event._raw.start_time.slice(0, 10);
          await calendarEventsCreateExceptionCreate({
            path: { id },
            body: {
              exception_date: exceptionDate,
              is_cancelled: true,
            },
          });
          break;
        }

        case 'following': {
          // Cancel this occurrence and all future ones via bulk-modify.
          // modification_start_date: ISO date of this occurrence's start.
          const modificationStartDate = event._raw.start_time.slice(0, 10);
          await calendarEventsBulkModifyCreate({
            path: { id },
            body: {
              modification_start_date: modificationStartDate,
              is_cancelled: true,
            },
          });
          break;
        }

        case 'all': {
          // Cancel the entire series by destroying the parent.
          await calendarEventsDestroy({ path: { id } });
          break;
        }
      }
    }

    // Invalidate all calendar events queries so all views refresh.
    await invalidateCalendarEvents(queryClient);
  };

  return { cancelBooking };
}
