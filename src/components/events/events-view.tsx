'use client';

/**
 * EventsView — member events list composition.
 *
 * Owns:
 *  - view mode state ('list' / 'month'; 'week' added in Phase 14)
 *  - anchor date state (today by default)
 *  - visible range computation via eventRange
 *  - calendar scope state (calendarId, synced to ?calendar= URL param in Phase 15)
 *  - fetching via useCalendarEvents (bound to the visible range + calendarId)
 *  - rendering via CalendarView
 *
 * View toggle:
 *   A tabs-style control (List / Month / Week) lets the member switch views. The
 *   range computation and fetch automatically recompute when the view changes.
 *
 * Calendar scope (Phase 15):
 *   A CalendarScopePicker allows the member to select a single calendar or "All".
 *   The selection is synced to the ?calendar= URL param so it survives reload +
 *   is shareable. Selecting a calendar refilters all three views.
 *
 * Timezone: the anchor is always `DateTime.now()` in the system local zone by
 * default.  When `initialDate` is a Luxon `DateTime`, its zone is preserved so
 * the fetch window aligns with the zone the caller intended.
 * `eventRange` converts the anchor to the right zone boundaries.
 *
 * Agenda window length (7 days) is kept consistent between the fetch
 * (`eventRange('list', …)` = 7 days) and the RBC agenda renderer
 * (`agendaLength={7}` on CalendarView) so no "No events in this range." false
 * positives appear for days 8–30 of the default 30-day RBC window.
 */

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { DateTime } from 'luxon';
import { CalendarView } from '@/components/calendar/calendar-view';
import type { CalendarViewMode } from '@/components/calendar/calendar-view';
import { CalendarScopePicker } from '@/components/calendar/calendar-scope-picker';
import type { CalendarOption } from '@/components/calendar/calendar-scope-picker';
import { useCalendarEvents } from '@/hooks/events/use-calendar-events';
import { useMyCalendars } from '@/hooks/calendars/use-my-calendars';
import { eventRange } from '@/lib/datetime/index';
import { Stack } from '@/components/layout/stack';
import { Text } from '@/components/layout/text';
import { HStack } from '@/components/layout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EventAttendeesSheet } from './event-attendees-editor';
import type { CalendarEventVM } from '@/components/calendar/event-vm';

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

export function EventsView({
  calendarId: propCalendarId,
  initialDate,
}: EventsViewProps) {
  // URL search params for persisting calendar scope (Phase 15).
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Event detail sheet state (Phase 19).
  const [selectedEvent, setSelectedEvent] =
    React.useState<CalendarEventVM | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const handleSelectEvent = React.useCallback((event: CalendarEventVM) => {
    setSelectedEvent(event);
    setSheetOpen(true);
  }, []);

  // view state — defaulting to agenda (list), controlled by a toggle below.
  // Maps: 'list' → agenda, 'month' → month, 'week'.
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

  // Calendar scope state (Phase 15): read from URL ?calendar= param.
  // If calendarId prop was passed, it takes precedence (for storybook/tests).
  // Otherwise, read from URL or default to null ("All calendars").
  const urlCalendarId = searchParams.get('calendar');
  const selectedCalendarId = React.useMemo<number | null>(() => {
    if (propCalendarId !== undefined) return propCalendarId;
    if (urlCalendarId) {
      const parsed = parseInt(urlCalendarId, 10);
      return !isNaN(parsed) ? parsed : null;
    }
    return null;
  }, [propCalendarId, urlCalendarId]);

  // Update URL when calendar scope changes.
  const handleCalendarChange = React.useCallback(
    (calendarId: number | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (calendarId === null) {
        params.delete('calendar');
      } else {
        params.set('calendar', String(calendarId));
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      router.push(`${pathname}${qs}`);
    },
    [router, pathname, searchParams]
  );

  // Fetch calendars for the scope picker.
  const { calendars, isLoading: calendarsLoading } = useMyCalendars({
    page: 1,
    pageSize: 100, // Fetch all calendars for the picker
    ordering: null,
    search: null,
  });

  // Convert API calendars to picker options.
  const calendarOptions: CalendarOption[] = React.useMemo(
    () =>
      calendars.map((cal) => ({
        id: cal.id,
        name: cal.name,
      })),
    [calendars]
  );

  // Compute the visible date range from the anchor + view mode.
  // Maps CalendarViewMode to eventRange view type:
  // - 'agenda' → 'list' (7-day window)
  // - 'month' → 'month' (full month padded to weeks)
  // - 'week' → 'week'
  const range = React.useMemo(() => {
    const rangeType = view === 'agenda' ? 'list' : view;
    return eventRange(rangeType, anchorDt, anchorDt.zoneName ?? 'UTC');
  }, [view, anchorDt]);

  const { events, isLoading, isError, error } = useCalendarEvents({
    range,
    calendarId: selectedCalendarId ?? undefined,
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
  // Populated / empty — render scope picker + view toggle + delegate to CalendarView.
  // agendaLength keeps the RBC agenda window (7 days) in sync with the
  // fetch window so days outside the fetched range don't appear empty.
  // ------------------------------------------------------------------
  return (
    <>
      <Stack gap={4} data-slot='events-view'>
        {/* Scope picker + View toggle in a horizontal layout */}
        <HStack gap={4} align='center' justify='between'>
          {/* Calendar scope picker (Phase 15) */}
          <div data-testid='calendar-scope-picker'>
            <CalendarScopePicker
              calendars={calendarOptions}
              value={selectedCalendarId}
              onChange={handleCalendarChange}
              disabled={calendarsLoading}
            />
          </div>

          {/* View toggle: List / Month / Week */}
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as CalendarViewMode)}
          >
            <TabsList>
              <TabsTrigger value='agenda'>List</TabsTrigger>
              <TabsTrigger value='week'>Week</TabsTrigger>
              <TabsTrigger value='month'>Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </HStack>

        {/* Calendar view — the range updates when view changes */}
        <CalendarView
          events={events}
          view={view}
          onViewChange={setView}
          date={anchorDate}
          onDateChange={handleDateChange}
          agendaLength={AGENDA_WINDOW_DAYS}
          minHeight={500}
          onSelectEvent={handleSelectEvent}
        />
      </Stack>

      {/* Event detail sheet (Phase 19) — opens when member clicks an event */}
      <EventAttendeesSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        event={selectedEvent}
      />
    </>
  );
}
