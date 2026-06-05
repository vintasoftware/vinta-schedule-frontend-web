'use client';

/**
 * CalendarView — react-big-calendar wrapper themed to design tokens.
 *
 * Exposes month / week / agenda (list) views over a shared `CalendarEventVM`.
 * The calendar renders client-side only (RBC is not SSR-safe); all data is
 * passed via props so higher-level components own fetching logic.
 *
 * Custom event rendering is exposed via the `eventRenderer` render-prop so
 * later phases (group-booking overlay, availability chips) can inject their
 * own content without forking this wrapper.
 *
 * Timezone: the luxonLocalizer uses Luxon's DateTime under the hood. Events
 * are positioned by their JS `Date` boundary (CalendarEventVM.start/end) which
 * captures the correct UTC instant. Display labels use the per-event `timezone`
 * and `timezoneLabel` fields from the VM — set by the mapping layer, not by
 * the local browser timezone.
 */

import * as React from 'react';
import {
  Calendar,
  luxonLocalizer,
  type View,
  type Components,
  type EventProps,
} from 'react-big-calendar';
import { DateTime } from 'luxon';
import './calendar-theme.css';
import { Flex } from '@/components/layout';
import type { CalendarEventVM } from './event-vm';

// ---------------------------------------------------------------------------
// Luxon localizer — wire to Phase 0c's Luxon (ISO week starts Monday = 1)
// ---------------------------------------------------------------------------
// luxonLocalizer takes the Luxon DateTime class; firstDayOfWeek=1 → Monday.
const localizer = luxonLocalizer(DateTime, { firstDayOfWeek: 1 });

// ---------------------------------------------------------------------------
// Default event renderer
//
// Renders the event title + a small timezone label. This is the hook-point for
// later overlays — callers pass `eventRenderer` to replace this entirely.
// ---------------------------------------------------------------------------

function DefaultEventContent({
  event,
}: {
  event: CalendarEventVM;
}): React.ReactElement {
  return (
    <span className='flex min-w-0 flex-col leading-tight'>
      <span className='truncate font-medium'>{event.title}</span>
      <span className='text-primary-foreground/70 truncate text-xs'>
        {event.timezoneLabel}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** The calendar view names supported by this wrapper. */
export type CalendarViewMode = 'month' | 'week' | 'agenda';

export interface CalendarViewProps {
  /**
   * Events to render. Typically sourced from an API hook and mapped through
   * `toCalendarEventVMs` in `event-vm.ts`.
   */
  events: CalendarEventVM[];
  /**
   * The currently active view. Controlled externally so the parent can sync
   * state with URL params or other UI (e.g. the CalendarScopePicker).
   */
  view: CalendarViewMode;
  /**
   * Called when the user navigates to a different view via the toolbar.
   */
  onViewChange: (view: CalendarViewMode) => void;
  /**
   * The date currently visible in the calendar (the anchor date). Controlled
   * externally so the parent can synchronise with URL params.
   */
  date: Date;
  /**
   * Called when the user navigates to a different date (prev/next/today).
   */
  onDateChange: (date: Date) => void;
  /**
   * Custom event renderer — the hook-point for group-booking / availability
   * overlays in later phases.  Receives the CalendarEventVM; should return the
   * content to render inside the event block.  When omitted, the default
   * renderer shows the title + timezone label.
   *
   * @example
   * ```tsx
   * <CalendarView
   *   eventRenderer={({ event }) => (
   *     <GroupBookingEventContent event={event} />
   *   )}
   * />
   * ```
   */
  eventRenderer?: React.ComponentType<{ event: CalendarEventVM }>;
  /**
   * Called when the user clicks an event. Later phases wire this to open the
   * event detail panel / booking dialog.
   */
  onSelectEvent?: (event: CalendarEventVM) => void;
  /**
   * Number of days the agenda (list) view should cover.
   * Must match the window produced by `eventRange` for the 'list' mode so that
   * RBC does not show "No events in this range." for days outside the fetch
   * window.  Defaults to 7 (matching `eventRange('list', …)` which returns a
   * 7-day window).  Phases 13/14 may pass a different value if they change the
   * list range.
   */
  agendaLength?: number;
  /**
   * Minimum height for the time-grid (week/day) scroll area in px.
   * Defaults to 600px.
   */
  minHeight?: number;
  /** Extra class name applied to the root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------

export function CalendarView({
  events,
  view,
  onViewChange,
  date,
  onDateChange,
  eventRenderer: EventRendererProp,
  onSelectEvent,
  agendaLength = 7,
  minHeight = 600,
  className,
}: CalendarViewProps): React.ReactElement {
  // Build the `components` prop once per render. The `event` slot is the
  // hook-point: callers supply `eventRenderer` to replace just the inner
  // content while the outer RBC chrome (position, selection, overlap) stays.
  const EventContent = EventRendererProp ?? DefaultEventContent;

  // Wrap EventContent in a named function component. The named declaration
  // (rather than an anonymous arrow) ensures React sees a stable component
  // identity in DevTools and avoids RBC treating a new anonymous function
  // reference as a new component type on every render (which would unmount/
  // remount every event cell).
  const EventComponent = React.useMemo<
    React.ComponentType<EventProps<CalendarEventVM>>
  >(
    () =>
      function CalendarEventRenderer({ event }: EventProps<CalendarEventVM>) {
        return <EventContent event={event} />;
      },
    [EventContent]
  );

  const components = React.useMemo<Components<CalendarEventVM>>(
    () => ({ event: EventComponent }),
    [EventComponent]
  );

  // RBC emits a generic `View` string; we narrow it to our controlled subset.
  const handleViewChange = React.useCallback(
    (next: View) => {
      if (next === 'month' || next === 'week' || next === 'agenda') {
        onViewChange(next);
      }
    },
    [onViewChange]
  );

  return (
    <Flex
      as='div'
      data-slot='calendar-view'
      direction='column'
      className={className}
      // minHeight is dynamic (prop-driven, no token); keep as style escape hatch
      style={{ minHeight }}
    >
      <Calendar<CalendarEventVM>
        localizer={localizer}
        events={events}
        view={view}
        date={date}
        onView={handleViewChange}
        onNavigate={onDateChange}
        onSelectEvent={onSelectEvent}
        components={components}
        // Accessor props — RBC reads start/end as JS Date from the VM
        startAccessor='start'
        endAccessor='end'
        titleAccessor='title'
        // Agenda (list) window length in days — must match the eventRange
        // window used by the data hook so days outside the fetch window do
        // not show "No events in this range." in the RBC agenda view.
        length={agendaLength}
        // Show month, week, agenda only (no day / work_week)
        views={['month', 'week', 'agenda']}
        // Localization strings
        messages={{
          agenda: 'List',
          next: 'Next',
          previous: 'Back',
          today: 'Today',
          month: 'Month',
          week: 'Week',
          noEventsInRange: 'No events in this range.',
          showMore: (count) => `+${count} more`,
        }}
        className='flex-1'
      />
    </Flex>
  );
}
