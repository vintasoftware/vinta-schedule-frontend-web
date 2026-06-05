'use client';

/**
 * EventsView — member events list composition.
 *
 * Owns:
 *  - view mode state (currently fixed to 'agenda'; phases 13/14 add a toggle)
 *  - anchor date state (today by default)
 *  - visible range computation via eventRange (Phase 0c)
 *  - fetching via useCalendarEvents (bound to the visible range)
 *  - rendering via CalendarView (Phase 0e)
 *
 * State contract for phases 13/14/15:
 *   `view` and `setView` are already threaded through the component so adding
 *   a view toggle in Phase 13 is purely additive — no structural refactor
 *   needed. `calendarId` (Phase 15) is already accepted and forwarded to the
 *   hook.
 *
 * Timezone: the anchor is always `DateTime.now()` in the system local zone by
 * default. Phase 0c's `eventRange` converts it to the right zone boundaries.
 * For the list/agenda view we use the 'list' mode (7-day window) from
 * eventRange so the initial range is sensible for a chronological list.
 */

import * as React from 'react';
import { DateTime } from 'luxon';
import { CalendarView } from '@/components/calendar/calendar-view';
import type { CalendarViewMode } from '@/components/calendar/calendar-view';
import { useCalendarEvents } from '@/hooks/events/use-calendar-events';
import { eventRange } from '@/lib/datetime/index';
import { Stack } from '@/components/layout/stack';
import { Text } from '@/components/layout/text';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EventsViewProps {
  /**
   * Optional calendar id — when supplied, only events for that calendar are
   * shown. Used by Phase 15 (calendar-scoped event view). When undefined all
   * events visible to the member are shown.
   */
  calendarId?: number;
  /**
   * Override the initial anchor date (default: today). Useful for tests and
   * for phases 13/14 when the URL params seed a specific date.
   */
  initialDate?: Date;
}

// ---------------------------------------------------------------------------
// EventsView
// ---------------------------------------------------------------------------

export function EventsView({ calendarId, initialDate }: EventsViewProps) {
  // view state — defaulting to agenda (list) for Phase 12.
  // Phases 13/14 replace this with a controlled toggle.
  const [view, setView] = React.useState<CalendarViewMode>('agenda');

  // Anchor date as a JS Date (for CalendarView's controlled date prop).
  // Accepts an optional initialDate for test overrides and future URL-param seeding.
  const [anchorDate, setAnchorDate] = React.useState<Date>(
    () => initialDate ?? new Date()
  );

  // Convert the anchor to a Luxon DateTime so eventRange can compute the
  // correct zoned window. We use the system local zone — the hook converts
  // everything to UTC-offset ISO strings for the API.
  const anchorDt = React.useMemo(
    () => DateTime.fromJSDate(anchorDate),
    [anchorDate]
  );

  // Compute the visible date range from the anchor + view mode.
  // 'list' view = 7-day window (Phase 0c eventRange contract).
  const range = React.useMemo(
    () =>
      eventRange(
        view === 'agenda' ? 'list' : view,
        anchorDt,
        anchorDt.zoneName ?? 'UTC'
      ),
    [view, anchorDt]
  );

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
  // Populated / empty — delegate to CalendarView which renders
  // "No events in this range." for an empty event list in agenda mode.
  // ------------------------------------------------------------------
  return (
    <CalendarView
      events={events}
      view={view}
      onViewChange={setView}
      date={anchorDate}
      onDateChange={setAnchorDate}
      minHeight={500}
    />
  );
}
