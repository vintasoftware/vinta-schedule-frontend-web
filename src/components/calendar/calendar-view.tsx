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
  type ToolbarProps,
  type ViewsProps,
  type ViewStatic,
} from 'react-big-calendar';
import { DateTime } from 'luxon';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './calendar-theme.css';
import { Flex, HStack } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SchedulingChip } from '@/components/ui/scheduling-chip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils/index';
import {
  schedulingChipStatus,
  type CalendarEventVM,
  type SchedulingChipStatus,
} from './event-vm';

// ---------------------------------------------------------------------------
// Luxon localizer — wire to Phase 0c's Luxon (ISO week starts Monday = 1)
// ---------------------------------------------------------------------------
// luxonLocalizer takes the Luxon DateTime class; firstDayOfWeek=1 → Monday.
const localizer = luxonLocalizer(DateTime, { firstDayOfWeek: 1 });

// ---------------------------------------------------------------------------
// Default event renderer
//
// Renders the event as a SchedulingChip — the design-system event block whose
// left accent + tint carry the booking status. Used across all three views
// (month / week / list). This is the hook-point for later overlays: callers
// pass `eventRenderer` to replace the chip entirely.
//
// The `data-slot="scheduling-chip"` marker lets calendar-theme.css strip RBC's
// default `.rbc-event` chrome (bg/padding/border) so the chip owns the visuals.
// ---------------------------------------------------------------------------

/** Events shorter than this render as a single-line compact chip so the title
 *  stays readable in the (height ∝ duration) week/day time grid. */
const COMPACT_EVENT_THRESHOLD_MIN = 30;

interface EventContentProps {
  event: CalendarEventVM;
  /**
   * Enable the single-line compact variant for sub-30-min events. Only the
   * week/day time grid (where height ∝ duration) opts in; the list view and the
   * month "more" dialog have full height and always render the full chip.
   */
  compact?: boolean;
}

function DefaultEventContent({
  event,
  compact = false,
}: EventContentProps): React.ReactElement {
  const startLabel = event.startDt.isValid
    ? event.startDt.toFormat('h:mm a')
    : '';
  const endLabel = event.endDt.isValid ? event.endDt.toFormat('h:mm a') : '';
  const timeRange =
    startLabel && endLabel ? `${startLabel} – ${endLabel}` : startLabel;

  const durationMin =
    event.startDt.isValid && event.endDt.isValid
      ? event.endDt.diff(event.startDt, 'minutes').minutes
      : Infinity;

  // Compact variant: same chip look (left accent + tint) but a single line so
  // it stays legible when the slot is only a few px tall. The title leads (it
  // matters most); the start time follows, de-emphasised, only if it fits.
  if (compact && durationMin < COMPACT_EVENT_THRESHOLD_MIN) {
    return (
      <SchedulingChip
        data-slot='scheduling-chip'
        data-compact=''
        status={schedulingChipStatus(event.status)}
        className='h-full w-full flex-row items-baseline gap-1 py-0'
        title={
          <span className='truncate'>
            {event.title}
            {startLabel ? (
              <span className='ml-1 font-normal opacity-70'>{startLabel}</span>
            ) : null}
          </span>
        }
      />
    );
  }

  return (
    <SchedulingChip
      data-slot='scheduling-chip'
      status={schedulingChipStatus(event.status)}
      className='h-full w-full'
      title={event.title}
      meta={
        <span className='flex flex-wrap items-center gap-x-1'>
          {timeRange ? <span>{timeRange}</span> : null}
          <span>{event.timezoneLabel}</span>
        </span>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Event-render context
//
// The resolved event renderer (the default chip, or a caller's `eventRenderer`
// override) is shared with our custom views (list / month dialog) via context,
// so they don't depend on RBC's `components.event` plumbing. The week time grid
// passes `compact` to opt into the single-line variant; the custom views never
// do, so the list view always renders the full chip.
// ---------------------------------------------------------------------------

const EventRenderContext =
  React.createContext<React.ComponentType<EventContentProps>>(
    DefaultEventContent
  );

// ---------------------------------------------------------------------------
// Custom toolbar
//
// Replaces RBC's built-in toolbar so the view switcher uses our shadcn `Tabs`
// component (Radix under the hood) instead of RBC's own button group. The
// nav controls (Today / Back / Next) use our `Button`. RBC still drives the
// state: the Tabs value is the controlled `view`, and `onValueChange` calls
// RBC's `onView`; the nav buttons call `onNavigate`.
// ---------------------------------------------------------------------------

/** The view names this wrapper renders, in display order. */
const TOOLBAR_VIEWS: View[] = ['month', 'week', 'agenda'];

function CalendarToolbar({
  label,
  view,
  views,
  onView,
  onNavigate,
  localizer,
}: ToolbarProps<CalendarEventVM>): React.ReactElement {
  const { messages } = localizer;

  // RBC passes `views` as an array or an object map; narrow to the enabled
  // subset while preserving our display order.
  const enabled = Array.isArray(views)
    ? views
    : TOOLBAR_VIEWS.filter((v) => (views as Record<string, boolean>)[v]);
  const viewList = TOOLBAR_VIEWS.filter((v) => enabled.includes(v));

  return (
    <Flex
      data-slot='calendar-toolbar'
      align='center'
      justify='between'
      gap={2}
      wrap
      className='mb-3'
    >
      <HStack gap={1}>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => onNavigate('TODAY')}
        >
          {messages.today}
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          aria-label={String(messages.previous ?? 'Back')}
          onClick={() => onNavigate('PREV')}
        >
          <ChevronLeft />
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          aria-label={String(messages.next ?? 'Next')}
          onClick={() => onNavigate('NEXT')}
        >
          <ChevronRight />
        </Button>
      </HStack>

      <span className='text-foreground text-base font-medium'>{label}</span>

      <Tabs value={view} onValueChange={(next) => onView(next as View)}>
        <TabsList>
          {viewList.map((name) => (
            <TabsTrigger key={name} value={name}>
              {String(messages[name as keyof typeof messages] ?? name)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </Flex>
  );
}

// ---------------------------------------------------------------------------
// AgendaChipList — custom "list" view that renders a stacked list of
// SchedulingChips grouped by day, instead of RBC's default agenda <table>.
//
// Registered via `views={{ agenda: AgendaChipList }}`, so RBC keeps driving the
// toolbar (label / navigation / view switch) while this component owns the body.
// The static range/navigate/title mirror RBC's built-in Agenda so navigation
// and the header label behave identically (they read `length` + `localizer`
// from the props RBC passes in).
// ---------------------------------------------------------------------------

const AGENDA_DEFAULT_LENGTH = 7;

/** Minimal shape of the RBC localizer methods this view relies on. */
interface AgendaLocalizer {
  add: (date: Date, count: number, unit: string) => Date;
  format: (range: { start: Date; end: Date }, format: string) => string;
}

interface AgendaViewProps {
  date: Date;
  events: CalendarEventVM[];
  length?: number;
  onSelectEvent?: (event: CalendarEventVM, e: React.SyntheticEvent) => void;
}

interface AgendaViewStaticOptions {
  length?: number;
  localizer: AgendaLocalizer;
}

function AgendaChipList({
  date,
  events,
  length = AGENDA_DEFAULT_LENGTH,
  onSelectEvent,
}: AgendaViewProps): React.ReactElement {
  // Full chip (never compact) — the list view has full vertical room.
  const EventContent = React.useContext(EventRenderContext);

  // Bucket events into the localizer-zone days of the [date, date+length) window,
  // matching how the month/week grids position the same events.
  const rangeStart = DateTime.fromJSDate(date).startOf('day');
  const groupedDays = Array.from({ length }, (_, i) => {
    const day = rangeStart.plus({ days: i });
    const dayStart = day.startOf('day').toMillis();
    const dayEnd = day.endOf('day').toMillis();
    const dayEvents = events
      .filter((e) => e.start.getTime() <= dayEnd && e.end.getTime() >= dayStart)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    return {
      key: day.toISODate() ?? String(i),
      label: day.toFormat('cccc, LLL d'),
      events: dayEvents,
    };
  }).filter((d) => d.events.length > 0);

  if (groupedDays.length === 0) {
    return (
      <div data-slot='agenda-chip-list' className='rbc-agenda-empty'>
        No events in this range.
      </div>
    );
  }

  return (
    <div data-slot='agenda-chip-list' className='flex flex-col gap-4 p-2'>
      {groupedDays.map((day) => (
        <section key={day.key} className='flex flex-col gap-2'>
          <h3 className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
            {day.label}
          </h3>
          <ul className='flex flex-col gap-1.5'>
            {day.events.map((event) => (
              <li key={event.id}>
                <button
                  type='button'
                  className='block w-full text-left'
                  onClick={(e) => onSelectEvent?.(event, e)}
                >
                  <EventContent event={event} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

AgendaChipList.range = (
  start: Date,
  { localizer }: AgendaViewStaticOptions
) => {
  const end = localizer.add(start, AGENDA_DEFAULT_LENGTH, 'day');
  return { start, end };
};

AgendaChipList.navigate = (
  date: Date,
  action: 'PREV' | 'NEXT' | 'TODAY' | 'DATE',
  { length = AGENDA_DEFAULT_LENGTH, localizer }: AgendaViewStaticOptions
) => {
  switch (action) {
    case 'PREV':
      return localizer.add(date, -length, 'day');
    case 'NEXT':
      return localizer.add(date, length, 'day');
    default:
      return date;
  }
};

AgendaChipList.title = (
  start: Date,
  { length = AGENDA_DEFAULT_LENGTH, localizer }: AgendaViewStaticOptions
) => {
  const end = localizer.add(start, length, 'day');
  return localizer.format({ start, end }, 'agendaHeaderFormat');
};

// ---------------------------------------------------------------------------
// MonthChipGrid — custom "month" view.
//
// The SchedulingChip is too tall for a month cell that may hold many events, so
// the month grid uses a compact one-line item (status dot + time + title)
// instead. Each day shows at most MONTH_VISIBLE_LIMIT events; the rest collapse
// into a "+N more" button that opens a dialog listing the full day.
//
// Registered via `views={{ month: MonthChipGrid }}` so RBC still drives the
// toolbar; static range/navigate/title mirror RBC's built-in MonthView.
// ---------------------------------------------------------------------------

const MONTH_VISIBLE_LIMIT = 3;

const CHIP_DOT_CLASS: Record<SchedulingChipStatus, string> = {
  booked: 'bg-vinta-600',
  available: 'bg-teal-600',
  tentative: 'bg-warning',
  conflict: 'bg-destructive',
};

interface MonthLocalizer {
  add: (date: Date, count: number, unit: string) => Date;
  format: (date: Date, format: string) => string;
  firstVisibleDay: (date: Date, localizer: unknown) => Date;
  lastVisibleDay: (date: Date, localizer: unknown) => Date;
}

interface MonthViewProps {
  date: Date;
  events: CalendarEventVM[];
  getNow?: () => Date;
  onSelectEvent?: (event: CalendarEventVM, e?: React.SyntheticEvent) => void;
}

interface MonthViewStaticOptions {
  localizer: MonthLocalizer;
}

/** Events overlapping a given calendar day, sorted by start. */
function eventsOnDay(
  events: CalendarEventVM[],
  day: DateTime
): CalendarEventVM[] {
  const dayStart = day.startOf('day').toMillis();
  const dayEnd = day.endOf('day').toMillis();
  return events
    .filter((e) => e.start.getTime() <= dayEnd && e.end.getTime() >= dayStart)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function MonthCompactEvent({
  event,
  onSelect,
}: {
  event: CalendarEventVM;
  onSelect?: (event: CalendarEventVM, e?: React.SyntheticEvent) => void;
}): React.ReactElement {
  const time = event.startDt.isValid ? event.startDt.toFormat('h:mm') : '';
  return (
    <button
      type='button'
      onClick={(e) => onSelect?.(event, e)}
      title={event.title}
      className='hover:bg-muted flex h-5 w-full items-center gap-1 rounded px-1 text-left text-xs'
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          CHIP_DOT_CLASS[schedulingChipStatus(event.status)]
        )}
        aria-hidden
      />
      {time ? (
        <span className='text-muted-foreground shrink-0 tabular-nums'>
          {time}
        </span>
      ) : null}
      <span className='truncate font-medium'>{event.title}</span>
    </button>
  );
}

function DayEventsDialog({
  day,
  events,
  onClose,
  onSelectEvent,
}: {
  day: DateTime | null;
  events: CalendarEventVM[];
  onClose: () => void;
  onSelectEvent?: (event: CalendarEventVM, e?: React.SyntheticEvent) => void;
}): React.ReactElement {
  // Full chip (never compact) — the dialog has full vertical room.
  const EventContent = React.useContext(EventRenderContext);
  return (
    <Dialog open={day != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {day ? day.toFormat('cccc, LLLL d') : 'Events'}
          </DialogTitle>
        </DialogHeader>
        <div className='flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto'>
          {events.map((event) => (
            <button
              key={event.id}
              type='button'
              className='block w-full text-left'
              onClick={(e) => {
                onSelectEvent?.(event, e);
                onClose();
              }}
            >
              <EventContent event={event} />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MonthChipGrid({
  date,
  events,
  getNow,
  onSelectEvent,
}: MonthViewProps): React.ReactElement {
  const [dialogDay, setDialogDay] = React.useState<DateTime | null>(null);

  const monthStart = DateTime.fromJSDate(date).startOf('month');
  const gridStart = monthStart.startOf('week');
  const gridEnd = monthStart.endOf('month').endOf('week');
  const today = DateTime.fromJSDate(getNow ? getNow() : new Date()).startOf(
    'day'
  );

  const days: DateTime[] = [];
  for (let d = gridStart; d <= gridEnd; d = d.plus({ days: 1 })) {
    days.push(d);
  }
  const weekdayLabels = days.slice(0, 7).map((d) => d.toFormat('ccc'));

  const dialogEvents = dialogDay ? eventsOnDay(events, dialogDay) : [];

  return (
    <div
      data-slot='month-chip-grid'
      className='border-border bg-card overflow-hidden rounded-md border'
    >
      <div className='grid grid-cols-7'>
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className='text-muted-foreground border-border border-b px-2 py-1.5 text-xs font-semibold tracking-wide uppercase'
          >
            {label}
          </div>
        ))}
      </div>
      <div className='grid grid-cols-7'>
        {days.map((day) => {
          const dayEvents = eventsOnDay(events, day);
          const visible = dayEvents.slice(0, MONTH_VISIBLE_LIMIT);
          const overflow = dayEvents.length - visible.length;
          const isOffRange = day.month !== monthStart.month;
          const isToday = day.hasSame(today, 'day');
          return (
            <div
              key={day.toISODate()}
              className={cn(
                'border-border flex min-h-[7rem] flex-col gap-0.5 border-r border-b p-1 last:border-r-0',
                isOffRange && 'bg-muted/40',
                isToday && 'bg-accent'
              )}
            >
              <div
                className={cn(
                  'px-1 text-xs',
                  isOffRange
                    ? 'text-muted-foreground'
                    : 'text-foreground font-medium',
                  isToday && 'text-primary font-bold'
                )}
              >
                {day.day}
              </div>
              {visible.map((event) => (
                <MonthCompactEvent
                  key={event.id}
                  event={event}
                  onSelect={onSelectEvent}
                />
              ))}
              {overflow > 0 ? (
                <button
                  type='button'
                  onClick={() => setDialogDay(day)}
                  className='text-muted-foreground hover:text-foreground px-1 text-left text-xs font-medium'
                >
                  +{overflow} more
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <DayEventsDialog
        day={dialogDay}
        events={dialogEvents}
        onClose={() => setDialogDay(null)}
        onSelectEvent={onSelectEvent}
      />
    </div>
  );
}

MonthChipGrid.range = (date: Date, { localizer }: MonthViewStaticOptions) => ({
  start: localizer.firstVisibleDay(date, localizer),
  end: localizer.lastVisibleDay(date, localizer),
});

MonthChipGrid.navigate = (
  date: Date,
  action: 'PREV' | 'NEXT' | 'TODAY' | 'DATE',
  { localizer }: MonthViewStaticOptions
) => {
  switch (action) {
    case 'PREV':
      return localizer.add(date, -1, 'month');
    case 'NEXT':
      return localizer.add(date, 1, 'month');
    default:
      return date;
  }
};

MonthChipGrid.title = (date: Date, { localizer }: MonthViewStaticOptions) =>
  localizer.format(date, 'monthHeaderFormat');

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
  // This slot is only consumed by RBC's week/day time grid (month + list are
  // custom views), so it opts into the compact single-line variant for short
  // events — where height ∝ duration and a two-line chip would clip.
  const EventComponent = React.useMemo<
    React.ComponentType<EventProps<CalendarEventVM>>
  >(
    () =>
      function CalendarEventRenderer({ event }: EventProps<CalendarEventVM>) {
        return <EventContent event={event} compact />;
      },
    [EventContent]
  );

  const components = React.useMemo<Components<CalendarEventVM>>(
    () => ({ event: EventComponent, toolbar: CalendarToolbar }),
    [EventComponent]
  );

  // week uses RBC's time-grid built-in (with our SchedulingChip event slot);
  // month and list ("agenda") are our own custom views. RBC still renders the
  // toolbar for all three.
  const views = React.useMemo<ViewsProps<CalendarEventVM>>(
    () => ({
      // RBC's ViewStatic types omit `localizer` from the title/navigate option
      // bag (it injects it at runtime); cast through unknown to register.
      month: MonthChipGrid as unknown as React.ComponentType<unknown> &
        ViewStatic,
      week: true,
      agenda: AgendaChipList as unknown as React.ComponentType<unknown> &
        ViewStatic,
    }),
    []
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
    <EventRenderContext.Provider value={EventContent}>
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
          // Show month, week, agenda only (no day / work_week). Agenda is our
          // custom SchedulingChip list (see AgendaChipList above).
          views={views}
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
    </EventRenderContext.Provider>
  );
}
