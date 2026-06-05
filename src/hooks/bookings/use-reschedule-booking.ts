/**
 * useRescheduleBooking — move a calendar event to a new start/end time.
 *
 * Scope → operation mapping:
 *
 *   Non-recurring event (or scope = 'all' on a recurring series):
 *     calendarEventsPartialUpdate(id, { start_time, end_time, timezone })
 *     → PATCH /calendar-events/{id}/
 *     Updates the event's start/end time in place. The backend cascades the
 *     time change to any co-booked blocked-times associated with this event
 *     (backend-cascade assumption — see note below).
 *
 *   Recurring event, scope = 'this':
 *     calendarEventsCreateExceptionCreate(id, {
 *       exception_date,
 *       modified_start_time,
 *       modified_end_time,
 *     })
 *     → POST /calendar-events/{id}/create-exception/
 *     Creates a reschedule exception for the specific occurrence identified by
 *     `event._raw.start_time` (the date portion). Only this occurrence is moved;
 *     the parent series survives unchanged.
 *
 *   Recurring event, scope = 'following':
 *     calendarEventsBulkModifyCreate(id, {
 *       modification_start_date,
 *       modified_start_time_offset,
 *       modified_end_time_offset,
 *     })
 *     → POST /calendar-events/{id}/bulk-modify/
 *     Modifies this occurrence and all future ones by passing the new time as
 *     an offset from midnight (format "HH:MM:SS") for both start and end.
 *     `modification_start_date` is the ISO date of this occurrence's start_time.
 *
 * Co-booked blocked-times cascade:
 *   The backend is assumed to cascade the time change to co-booked blocked-times
 *   when the parent event is updated. This mirrors the pattern used in
 *   useCancelBooking where blocked-times are also assumed to cascade on delete.
 *   If the backend does NOT cascade, the blocked-times will become stale; in that
 *   case, a follow-up phase should explicitly update them here. For now, we rely
 *   on backend cascade and document it.
 *
 * Cache invalidation:
 *   On success: invalidateCalendarEvents(queryClient) — refreshes all calendar views.
 */

import { useQueryClient } from '@tanstack/react-query';
import {
  calendarEventsPartialUpdate,
  calendarEventsCreateExceptionCreate,
  calendarEventsBulkModifyCreate,
} from '@/client/sdk.gen';
import { invalidateCalendarEvents } from '@/hooks/events/use-calendar-events';
import type { CalendarEventVM } from '@/components/calendar/event-vm';
import type { RecurringScope } from '@/components/bookings/scope-prompt-dialog';
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Luxon DateTime to an "HH:MM:SS" time-of-day offset string suitable
 * for the `modified_start_time_offset` / `modified_end_time_offset` fields in
 * the bulk-modify API body.
 *
 * The backend interprets this as a Python `timedelta` from midnight (00:00:00),
 * representing the new time of day for the modified occurrences.
 */
function toTimeOffset(dt: DateTime): string {
  const h = String(dt.hour).padStart(2, '0');
  const m = String(dt.minute).padStart(2, '0');
  const s = String(dt.second).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// ---------------------------------------------------------------------------
// useRescheduleBooking
// ---------------------------------------------------------------------------

export function useRescheduleBooking() {
  const queryClient = useQueryClient();

  /**
   * Reschedule the given event to a new start/end time.
   *
   * @param event     The CalendarEventVM to reschedule (must have `_raw.id`).
   * @param newStart  New start time as ISO string (with timezone offset).
   * @param newEnd    New end time as ISO string (with timezone offset).
   * @param timezone  IANA timezone name for the new times (e.g. "America/New_York").
   * @param scope     Required when `event.isRecurring` is true. Ignored for
   *                  non-recurring events. Defaults to 'all' for safety when
   *                  accidentally omitted on a recurring event.
   */
  const rescheduleBooking = async (
    event: CalendarEventVM,
    newStart: string,
    newEnd: string,
    timezone: string,
    scope?: RecurringScope
  ): Promise<void> => {
    const id = String(event._raw.id);

    if (!event.isRecurring) {
      // Non-recurring: PATCH the event directly with new times.
      await calendarEventsPartialUpdate({
        path: { id },
        body: {
          start_time: newStart,
          end_time: newEnd,
          timezone,
        },
      });
    } else {
      // Recurring: apply the chosen scope.
      const resolvedScope: RecurringScope = scope ?? 'all';

      switch (resolvedScope) {
        case 'this': {
          // Reschedule only this occurrence via a modification exception.
          // The exception_date is the ISO date of the original occurrence's
          // start_time (date-only portion, matching the API's recurrence_id format).
          const exceptionDate = event._raw.start_time.slice(0, 10);
          await calendarEventsCreateExceptionCreate({
            path: { id },
            body: {
              exception_date: exceptionDate,
              modified_start_time: newStart,
              modified_end_time: newEnd,
              // is_cancelled is omitted (falsy) — this is a modification, not a cancel.
            },
          });
          break;
        }

        case 'following': {
          // Reschedule this occurrence and all future ones via bulk-modify.
          // modification_start_date: ISO date of this occurrence's start.
          // modified_start_time_offset / modified_end_time_offset: "HH:MM:SS"
          // time-of-day offsets representing the new time for all affected occurrences.
          const modificationStartDate = event._raw.start_time.slice(0, 10);
          const newStartDt = DateTime.fromISO(newStart, { zone: timezone });
          const newEndDt = DateTime.fromISO(newEnd, { zone: timezone });
          await calendarEventsBulkModifyCreate({
            path: { id },
            body: {
              modification_start_date: modificationStartDate,
              modified_start_time_offset: toTimeOffset(newStartDt),
              modified_end_time_offset: toTimeOffset(newEndDt),
            },
          });
          break;
        }

        case 'all': {
          // Reschedule the entire series by patching the parent event's times.
          await calendarEventsPartialUpdate({
            path: { id },
            body: {
              start_time: newStart,
              end_time: newEnd,
              timezone,
            },
          });
          break;
        }
      }
    }

    // Invalidate all calendar events queries so all views refresh.
    await invalidateCalendarEvents(queryClient);
  };

  return { rescheduleBooking };
}
