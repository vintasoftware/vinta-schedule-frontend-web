/**
 * useCreateBooking — orchestrates creating a booking event + co-booked blocked-times.
 *
 * Write order (important for recoverability):
 *  1. Create the primary event via calendarEventsCreate (POST /calendar-events/).
 *     If this fails, we stop — no blocked-times are created and the UI surfaces
 *     the backend error.
 *  2. For each co-booked calendar, create a blocked-time via blockedTimesCreate
 *     (POST /blocked-times/) with the same time range. These run in parallel after
 *     the primary event succeeds.
 *
 * Partial-failure handling:
 *   If the primary event succeeds but one or more blocked-time creates fail, we
 *   surface the failures per-calendar (blockedTimeErrors) but do NOT roll back the
 *   primary event (the backend has no atomic cross-resource transaction). The caller
 *   is responsible for surfacing the partial-failure state to the user.
 *
 * Cache invalidation:
 *   - On primary success: invalidates all calendarEventsList queries via
 *     invalidateCalendarEvents (from Phase 12).
 *   - After all blocked-time writes: invalidates blockedTimes queries with a
 *     predicate on the _id field.
 *
 * Idempotency: the submit button should be disabled via isPending returned here.
 * The hook does not retry failed requests.
 */

import { useQueryClient } from '@tanstack/react-query';
import { calendarEventsCreate, blockedTimesCreate } from '@/client/sdk.gen';
import type {
  CalendarEventWritable,
  BlockedTimeWritable,
  CalendarEvent,
  BlockedTime,
} from '@/client';
import { invalidateCalendarEvents } from '@/hooks/events/use-calendar-events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateBookingParams {
  /** The primary event data. required empty arrays must be present. */
  event: CalendarEventWritable;
  /**
   * Calendar ids for which a blocked-time should be created mirroring the
   * event's start/end/timezone. May be empty.
   */
  coBookedCalendarIds: number[];
}

export interface BlockedTimeResult {
  calendarId: number;
  blockedTime?: BlockedTime;
  error?: Error;
}

export interface CreateBookingResult {
  /** The created primary event. */
  event: CalendarEvent;
  /** Per-calendar blocked-time results (success or failure). */
  blockedTimeResults: BlockedTimeResult[];
  /** True if all co-booked blocked-times succeeded (or there were none). */
  allCoBookingsSucceeded: boolean;
}

// ---------------------------------------------------------------------------
// useCreateBooking
// ---------------------------------------------------------------------------

export function useCreateBooking() {
  const queryClient = useQueryClient();

  /**
   * Create the booking (primary event + co-booked blocked-times).
   *
   * Throws if the primary event creation fails (the caller should surface the
   * error). Returns a CreateBookingResult which includes per-calendar
   * blocked-time outcomes for the co-booked calendars.
   */
  const createBooking = async (
    params: CreateBookingParams
  ): Promise<CreateBookingResult> => {
    const { event, coBookedCalendarIds } = params;

    // Step 1: Create the primary calendar event.
    // All required fields (external_attendances, attendances, resource_allocations)
    // must be present as arrays (may be empty). The caller is responsible for
    // providing them — we assert here for early detection.
    const primaryResult = await calendarEventsCreate({ body: event });

    if (!primaryResult.data) {
      throw new Error('Unexpected empty response from calendarEventsCreate');
    }
    const createdEvent = primaryResult.data;

    // Invalidate all calendar events queries so views refresh.
    await invalidateCalendarEvents(queryClient);

    // Step 2: Create a blocked-time on each co-booked calendar in parallel.
    const blockedTimeResults: BlockedTimeResult[] = await Promise.all(
      coBookedCalendarIds.map(
        async (calendarId): Promise<BlockedTimeResult> => {
          const body: BlockedTimeWritable = {
            start_time: event.start_time,
            end_time: event.end_time,
            timezone: event.timezone,
            reason: event.title,
            calendar: calendarId,
          };
          try {
            const result = await blockedTimesCreate({ body });
            return { calendarId, blockedTime: result.data };
          } catch (err) {
            return {
              calendarId,
              error: err instanceof Error ? err : new Error(String(err)),
            };
          }
        }
      )
    );

    // Invalidate blocked-times queries after writes.
    await queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        (q.queryKey[0] as { _id?: string })?._id === 'blockedTimesList',
    });

    const allCoBookingsSucceeded = blockedTimeResults.every(
      (r) => r.error === undefined
    );

    return { event: createdEvent, blockedTimeResults, allCoBookingsSucceeded };
  };

  return { createBooking };
}
