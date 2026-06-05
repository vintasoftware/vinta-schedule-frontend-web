/**
 * useCalendarEvents — fetch calendar events for a visible date range.
 *
 * Range→query mapping decision:
 *   We use `start_time_range_after` / `start_time_range_before` to express
 *   "events whose start_time falls within the visible window". These are
 *   inclusive bounds so an event starting exactly at window-start is included.
 *
 *   The alternative would be `start_time` / `end_time` (exact equality). The
 *   range-after/before pair is the right fit for windowed fetches; exact
 *   equality is for point-in-time lookups.
 *
 *   `toApiRange(range)` (Phase 0c) converts Luxon DateTimes to ISO strings
 *   with UTC offsets baked in, so the backend sees the exact moments regardless
 *   of server timezone.
 *
 * The returned `events` array is already mapped to `CalendarEventVM[]` via
 * `toCalendarEventVMs` (Phase 0e), so the caller can pass them directly to
 * `CalendarView`. Chronological order is produced by RBC's event sorter on
 * the VM's `start` (JS Date), but the backend also returns events in
 * start-time order — both layers reinforce it.
 */

import { useQuery } from '@tanstack/react-query';
import {
  calendarEventsListOptions,
  calendarEventsListQueryKey,
} from '@/client/@tanstack/react-query.gen';
import { toCalendarEventVMs } from '@/components/calendar/event-vm';
import type { CalendarEventVM } from '@/components/calendar/event-vm';
import { toApiRange } from '@/lib/datetime/index';
import type { DateRange } from '@/lib/datetime/index';

// ---------------------------------------------------------------------------
// CALENDAR_EVENTS_QUERY_KEY
//
// Base query key for `calendarEventsList`. Exported so mutations
// (event create/update/delete phases) can invalidate all event-list queries.
// ---------------------------------------------------------------------------

export const CALENDAR_EVENTS_QUERY_KEY = calendarEventsListQueryKey();

// ---------------------------------------------------------------------------
// Hook input
// ---------------------------------------------------------------------------

export interface UseCalendarEventsOptions {
  /** The visible date range (computed by eventRange from Phase 0c). */
  range: DateRange;
  /**
   * Optional calendar id — when provided, only events for that calendar are
   * returned. Used by Phase 15 (calendar-scoped view).
   */
  calendarId?: number;
}

// ---------------------------------------------------------------------------
// useCalendarEvents
// ---------------------------------------------------------------------------

export function useCalendarEvents({
  range,
  calendarId,
}: UseCalendarEventsOptions): {
  events: CalendarEventVM[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  eventsQuery: ReturnType<typeof useQuery>;
} {
  const apiRange = toApiRange(range);

  const eventsQuery = useQuery(
    calendarEventsListOptions({
      query: {
        start_time_range_after: apiRange.start,
        start_time_range_before: apiRange.end,
        ...(calendarId !== undefined ? { calendar: calendarId } : {}),
      },
    })
  );

  // Map raw API events → CalendarEventVMs. Events arrive in start-time order
  // from the backend; the VM mapping preserves that order so CalendarView's
  // agenda view renders them chronologically. calendarId is threaded as the
  // optional owner id hint.
  const rawResults = eventsQuery.data?.results ?? [];
  const events: CalendarEventVM[] = toCalendarEventVMs(rawResults, calendarId);

  return {
    events,
    isLoading: eventsQuery.isLoading,
    isError: eventsQuery.isError,
    error: eventsQuery.error,
    eventsQuery,
  };
}
