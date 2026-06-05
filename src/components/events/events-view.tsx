'use client';

/**
 * EventsView — member events list composition.
 *
 * Owns:
 *  - view mode state ('list' / 'month'; 'week' added in Phase 14)
 *  - anchor date state (today by default)
 *  - visible range computation via eventRange
 *  - fetching via useCalendarEvents (bound to the visible range)
 *  - rendering via CalendarView
 *
 * View toggle:
 *   A tabs-style control (List / Month) lets the member switch views. The
 *   range computation and fetch automatically recompute when the view changes.
 *   Phases 13/14 add Month/Week views; the toggle is structured as a simple
 *   controlled state so adding Week in Phase 14 is trivial (insert one more tab).
 *
 * State contract for phases 13/14/15:
 *   `view` and `setView` are already threaded through the component. `calendarId`
 *   (Phase 15) is already accepted and forwarded to the hook.
 *
 * Timezone: the anchor is always `DateTime.now()` in the system local zone by
 * default.  When `initialDate` is a Luxon `DateTime`, its zone is preserved so
 * the fetch window aligns with the zone the caller intended (important for
 * Phase 15 where the anchor is seeded from a URL param that may carry zone
 * info).  `eventRange` converts the anchor to the right zone boundaries.
 *
 * Agenda window length (7 days) is kept consistent between the fetch
 * (`eventRange('list', …)` = 7 days) and the RBC agenda renderer
 * (`agendaLength={7}` on CalendarView) so no "No events in this range." false
 * positives appear for days 8–30 of the default 30-day RBC window.
 */

import * as React from 'react';
import { DateTime } from 'luxon';
import { CalendarView } from '@/components/calendar/calendar-view';
import type { CalendarViewMode } from '@/components/calendar/calendar-view';
import { useCalendarEvents } from '@/hooks/events/use-calendar-events';
import { eventRange } from '@/lib/datetime/index';
import { Stack } from '@/components/layout/stack';
import { Text } from '@/components/layout/text';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Number of days shown in agenda (list) view.
 * Must match the window `eventRange('list', …)` produces (7 days) so the
 * fetch window and the RBC agenda window are always in sync.
 */
const AGENDA_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EventsViewProps {
  /**
   * Optional calendar id — when supplied, only events for that calendar are
   * shown. Forwarded to the data hook; the backend scopes the results.
   */
  calendarId?: number;
  /**
   * Override the initial anchor date (default: today).  Accepts either a JS
   * `Date` or a Luxon `DateTime`.  When a `DateTime` is passed its zone is
   * preserved so the fetch window aligns with the intended timezone (e.g. when
   * Phase 15 seeds the anchor from a URL param that carries an IANA zone).
   */
  initialDate?: Date | DateTime;
}

// ---------------------------------------------------------------------------
// EventsView
// ---------------------------------------------------------------------------

export function EventsView({ calendarId, initialDate }: EventsViewProps) {
  // view state — defaulting to agenda (list), controlled by a toggle below.
  // Maps: 'list' → agenda, 'month' → month (Phase 14 adds 'week').
  const [view, setView] = React.useState<CalendarViewMode>('agenda');

  // Anchor as a Luxon DateTime — zone is preserved when initialDate is already
  // a DateTime; otherwise we use the system local zone.
  const [anchorDt, setAnchorDt] = React.useState<DateTime>(() => {
    if (!initialDate) return DateTime.now();
    if (initialDate instanceof DateTime) return initialDate;
    return DateTime.fromJSDate(initialDate);
  });

  // JS Date for CalendarView's controlled `date` prop.
  const anchorDate = React.useMemo(() => anchorDt.toJSDate(), [anchorDt]);

  // When CalendarView navigates, it hands back a JS Date. Re-wrap in a
  // DateTime to keep the zone — if the anchor had a specific zone, forward it;
  // otherwise fall back to the system zone.
  const handleDateChange = React.useCallback(
    (next: Date) => {
      const zone = anchorDt.zoneName ?? 'local';
      setAnchorDt(DateTime.fromJSDate(next, { zone }));
    },
    [anchorDt]
  );

  // Compute the visible date range from the anchor + view mode.
  // Maps CalendarViewMode to eventRange view type:
  // - 'agenda' → 'list' (7-day window)
  // - 'month' → 'month' (full month padded to weeks)
  // - 'week' (Phase 14) → 'week'
  const range = React.useMemo(() => {
    const rangeType = view === 'agenda' ? 'list' : view;
    return eventRange(rangeType, anchorDt, anchorDt.zoneName ?? 'UTC');
  }, [view, anchorDt]);

  const { events, isLoading, isError, error } = useCalendarEvents({
    range,
    calendarId,
  });

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------
  if (isLoading) {
    return (
      <Stack gap={4} data-slot='events-view-loading'>
        <Text color='muted-foreground'>Loading events…</Text>
      </Stack>
    );
  }

  // ------------------------------------------------------------------
  // Error state
  // ------------------------------------------------------------------
  if (isError) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return (
      <Stack gap={4} data-slot='events-view-error'>
        <Text color='destructive'>Failed to load events: {message}</Text>
      </Stack>
    );
  }

  // ------------------------------------------------------------------
  // Populated / empty — render view toggle + delegate to CalendarView.
  // agendaLength keeps the RBC agenda window (7 days) in sync with the
  // fetch window so days outside the fetched range don't appear empty.
  // ------------------------------------------------------------------
  return (
    <Stack gap={4} data-slot='events-view'>
      {/* View toggle: List / Month / Week */}
      <Tabs value={view} onValueChange={(v) => setView(v as CalendarViewMode)}>
        <TabsList>
          <TabsTrigger value='agenda'>List</TabsTrigger>
          <TabsTrigger value='week'>Week</TabsTrigger>
          <TabsTrigger value='month'>Month</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Calendar view — the range updates when view changes */}
      <CalendarView
        events={events}
        view={view}
        onViewChange={setView}
        date={anchorDate}
        onDateChange={handleDateChange}
        agendaLength={AGENDA_WINDOW_DAYS}
        minHeight={500}
      />
    </Stack>
  );
}
