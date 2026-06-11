/**
 * useCalendarEvents — fetch calendar events that overlap a visible date range.
 *
 * Overlap query strategy (not start-only):
 *   An event "overlaps" the visible window [windowStart, windowEnd] when:
 *     event.start_time  < windowEnd   AND
 *     event.end_time    > windowStart
 *
 *   Translated to API params:
 *     start_time_range_before = windowEnd   (events that start before the window ends)
 *     end_time_range_after    = windowStart (events that end after the window starts)
 *
 *   This correctly captures multi-day events that STARTED before the window but
 *   are still ongoing (e.g. a 3-day event that started yesterday).  A pure
 *   start-only approach (`start_time_range_after` / `start_time_range_before`)
 *   would silently drop those events.
 *
 * Pagination:
 *   The query requests a large `limit` (1 000) so all events within the bounded
 *   time window are returned in a single page.  This is appropriate for
 *   calendar views where the visible window is at most ~35 days.  If the server
 *   returns fewer results than `count` (i.e. the window holds more than 1 000
 *   events), a `truncated` flag is set and a console.warn is emitted.
 *
 * Cache invalidation:
 *   Each live query key is parameterised (contains the query args), so
 *   `CALENDAR_EVENTS_QUERY_KEY` (no args) will NOT match them with a direct
 *   `invalidateQueries({ queryKey })` call.  Use the exported helper instead:
 *
 *   ```ts
 *   invalidateCalendarEvents(queryClient);
 *   // or inline:
 *   queryClient.invalidateQueries({
 *     predicate: (q) =>
 *       Array.isArray(q.queryKey) &&
 *       (q.queryKey[0] as { _id?: string })?._id === 'calendarEventsList',
 *   });
 *   ```
 *
 * `toApiRange(range)` converts Luxon DateTimes to ISO strings with UTC offsets
 * baked in, so the backend sees exact moments regardless of server timezone.
 *
 * The returned `events` array is mapped to `CalendarEventVM[]` via
 * `toCalendarEventVMs` so the caller can pass them directly to `CalendarView`.
 */

import {
  useQuery,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  calendarEventsListOptions,
  calendarEventsListQueryKey,
} from '@/client/@tanstack/react-query.gen';
import type { CalendarEventsListResponse } from '@/client/types.gen';
import { toCalendarEventVMs } from '@/components/calendar/event-vm';
import type { CalendarEventVM } from '@/components/calendar/event-vm';
import { toApiRange } from '@/lib/datetime/index';
import type { DateRange } from '@/lib/datetime/index';

// ---------------------------------------------------------------------------
// CALENDAR_EVENTS_QUERY_KEY
//
// Base query key (no params).  The live query keys are parameterised, so this
// value does NOT match them for direct invalidation — use
// `invalidateCalendarEvents(queryClient)` instead.
// ---------------------------------------------------------------------------

export const CALENDAR_EVENTS_QUERY_KEY = calendarEventsListQueryKey();

/**
 * Invalidate all `calendarEventsList` queries regardless of their params.
 *
 * Use this in mutation `onSuccess` handlers that create, update, or delete
 * calendar events (phases 16, 20, 21, 22–24).  The predicate matches the
 * `_id` field embedded in each query key by the hey-api `createQueryKey`
 * factory, which is stable across different param combinations.
 */
export function invalidateCalendarEvents(
  queryClient: QueryClient
): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey) &&
      (q.queryKey[0] as { _id?: string })?._id === 'calendarEventsList',
  });
}

// ---------------------------------------------------------------------------
// Max events per bounded window
// ---------------------------------------------------------------------------

/**
 * Maximum events fetched per window.  At 1 000, even a very busy 35-day
 * calendar view returns all events in one page.  If the backend count exceeds
 * this, the hook surfaces a `truncated` flag (and logs a warning) rather than
 * silently dropping events.
 */
const CALENDAR_EVENTS_PAGE_LIMIT = 1000;

// ---------------------------------------------------------------------------
// Hook input
// ---------------------------------------------------------------------------

export interface UseCalendarEventsOptions {
  /** The visible date range (computed by eventRange). */
  range: DateRange;
  /**
   * Optional calendar id — when provided, only events for that calendar are
   * returned. Used by the calendar-scoped event view.
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
  /** True when count > results.length — some events were not returned. */
  truncated: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  eventsQuery: UseQueryResult<CalendarEventsListResponse>;
} {
  const apiRange = toApiRange(range);

  const eventsQuery = useQuery(
    calendarEventsListOptions({
      query: {
        // Overlap query: events overlapping [windowStart, windowEnd].
        // start_time_range_before: events whose start is before the window ends
        // end_time_range_after: events whose end is after the window starts
        // Together they select every event with any part inside the window.
        start_time_range_before: apiRange.end,
        end_time_range_after: apiRange.start,
        limit: CALENDAR_EVENTS_PAGE_LIMIT,
        ...(calendarId !== undefined ? { calendar: calendarId } : {}),
      },
    })
  );

  const rawResults = eventsQuery.data?.results ?? [];
  const totalCount = eventsQuery.data?.count ?? 0;
  const truncated = totalCount > rawResults.length;

  if (truncated) {
    // Non-fatal: surface in dev console so the issue is visible without
    // crashing the view.  Callers can also check the `truncated` flag and
    // show a UI indicator.
    console.warn(
      `[useCalendarEvents] Fetched ${rawResults.length} of ${totalCount} events. ` +
        `Increase CALENDAR_EVENTS_PAGE_LIMIT or narrow the date window.`
    );
  }

  // Map raw API events → CalendarEventVMs preserving backend start-time order.
  const events: CalendarEventVM[] = toCalendarEventVMs(rawResults, calendarId);

  return {
    events,
    truncated,
    isLoading: eventsQuery.isLoading,
    isError: eventsQuery.isError,
    error: eventsQuery.error,
    eventsQuery,
  };
}
