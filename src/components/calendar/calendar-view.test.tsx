/**
 * CalendarView unit tests.
 *
 * Covers:
 * - month / week / agenda views each render the same fixture events
 * - per-event timezone label correctness for two events in different zones
 * - view switch (via onViewChange) preserves the visible date range
 *
 * react-big-calendar needs a CSS environment; we rely on jsdom + the vitest
 * setup. RBC uses ResizeObserver and some browser APIs; we stub them below.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { CalendarView } from './calendar-view';
import type { CalendarEventVM } from './event-vm';
import { toCalendarEventVM, schedulingChipStatus } from './event-vm';
import type {
  CalendarEvent,
  RecurrenceRule as ApiRecurrenceRule,
} from '@/client';

// ---------------------------------------------------------------------------
// Browser API stubs required by react-big-calendar in jsdom
// ---------------------------------------------------------------------------

beforeAll(() => {
  // RBC reads scroll dimensions; jsdom returns 0 for all, which is fine.
  // RBC may also use ResizeObserver.
  if (!global.ResizeObserver) {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal stub for the required ParentEvent shape (non-recurring events). */
const STUB_PARENT_EVENT = {
  id: 0,
  title: '',
  external_id: '',
  start_time: '2024-01-01T00:00:00Z',
  end_time: '2024-01-01T00:00:00Z',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
} as const;

// Event in America/New_York (UTC-4 EDT in summer)
const RAW_NY: CalendarEvent = {
  id: 1,
  title: 'New York Meeting',
  start_time: '2024-06-15T14:00:00-04:00',
  end_time: '2024-06-15T15:00:00-04:00',
  timezone: 'America/New_York',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  external_id: 'ext-1',
  external_attendances: [],
  attendances: [],
  resource_allocations: [],
  parent_recurring_object: STUB_PARENT_EVENT,
  is_recurring: false,
  is_recurring_instance: false,
};

// Event in Australia/Sydney (UTC+10 AEST in June — no DST, southern hemisphere)
const RAW_SYD: CalendarEvent = {
  id: 2,
  title: 'Sydney Standup',
  start_time: '2024-06-15T09:00:00+10:00',
  end_time: '2024-06-15T09:30:00+10:00',
  timezone: 'Australia/Sydney',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  external_id: 'ext-2',
  external_attendances: [],
  attendances: [],
  resource_allocations: [],
  parent_recurring_object: STUB_PARENT_EVENT,
  is_recurring: false,
  is_recurring_instance: false,
};

// Event in America/New_York in November (EST = UTC-5, DST no longer active)
const RAW_NY_WINTER: CalendarEvent = {
  id: 3,
  title: 'Winter NY Meeting',
  start_time: '2024-11-15T14:00:00-05:00',
  end_time: '2024-11-15T15:00:00-05:00',
  timezone: 'America/New_York',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  external_id: 'ext-3',
  external_attendances: [],
  attendances: [],
  resource_allocations: [],
  parent_recurring_object: STUB_PARENT_EVENT,
  is_recurring: false,
  is_recurring_instance: false,
};

// Recurring event with a full recurrence_rule object
const STUB_RECURRENCE_RULE: ApiRecurrenceRule = {
  id: 10,
  frequency: 'WEEKLY',
  interval: 1,
  by_weekday: 'MO',
  rrule_string: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

const RAW_RECURRING: CalendarEvent = {
  id: 4,
  title: 'Weekly Recurring',
  start_time: '2024-06-17T10:00:00-04:00',
  end_time: '2024-06-17T11:00:00-04:00',
  timezone: 'America/New_York',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  external_id: 'ext-4',
  external_attendances: [],
  attendances: [],
  resource_allocations: [],
  parent_recurring_object: STUB_PARENT_EVENT,
  is_recurring: true,
  is_recurring_instance: false,
  recurrence_rule: STUB_RECURRENCE_RULE,
};

const VM_NY: CalendarEventVM = toCalendarEventVM(RAW_NY);
const VM_SYD: CalendarEventVM = toCalendarEventVM(RAW_SYD);
const VM_NY_WINTER: CalendarEventVM = toCalendarEventVM(RAW_NY_WINTER);
const VM_RECURRING: CalendarEventVM = toCalendarEventVM(RAW_RECURRING);

const FIXTURE_EVENTS: CalendarEventVM[] = [VM_NY, VM_SYD];

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

interface RenderCalendarOptions {
  view?: 'month' | 'week' | 'agenda';
  events?: CalendarEventVM[];
  onViewChange?: (v: 'month' | 'week' | 'agenda') => void;
  onDateChange?: (d: Date) => void;
  eventRenderer?: React.ComponentType<{ event: CalendarEventVM }>;
}

function renderCalendar({
  view = 'month',
  events = FIXTURE_EVENTS,
  onViewChange = vi.fn(),
  onDateChange = vi.fn(),
  eventRenderer,
}: RenderCalendarOptions = {}) {
  // Use a fixed date so the fixture events (June 2024) are in view for
  // month and week, and agenda covers a future range from today.
  const date = new Date('2024-06-15T00:00:00Z');

  return render(
    <CalendarView
      events={events}
      view={view}
      onViewChange={onViewChange}
      eventRenderer={eventRenderer}
      date={date}
      onDateChange={onDateChange}
    />
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CalendarView', () => {
  describe('month view', () => {
    it('renders without crashing', () => {
      const { container } = renderCalendar({ view: 'month' });
      expect(
        container.querySelector('[data-slot="calendar-view"]')
      ).toBeTruthy();
    });

    it('renders event titles in month view', () => {
      renderCalendar({ view: 'month' });
      // Both fixture event titles must appear — if either vanishes a regression is caught.
      // RBC month view renders event titles in the grid cells.
      expect(
        screen.getAllByText('New York Meeting').length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText('Sydney Standup').length
      ).toBeGreaterThanOrEqual(1);
      // Verify at least 2 distinct event titles are rendered (guards against
      // an implementation that shows only one event accidentally).
      const nyCount = screen.getAllByText('New York Meeting').length;
      const sydCount = screen.getAllByText('Sydney Standup').length;
      expect(nyCount + sydCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('week view', () => {
    it('renders without crashing', () => {
      const { container } = renderCalendar({ view: 'week' });
      expect(
        container.querySelector('[data-slot="calendar-view"]')
      ).toBeTruthy();
    });

    it('renders event titles in week view', () => {
      renderCalendar({ view: 'week' });
      // Both fixture event titles must appear. Week view in jsdom may not
      // position events via DOM layout, but RBC still produces event container
      // nodes. We assert on both title strings to catch regressions where
      // events are dropped entirely.
      expect(
        screen.getAllByText('New York Meeting').length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText('Sydney Standup').length
      ).toBeGreaterThanOrEqual(1);
      const nyCount = screen.getAllByText('New York Meeting').length;
      const sydCount = screen.getAllByText('Sydney Standup').length;
      expect(nyCount + sydCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('agenda view', () => {
    it('renders without crashing', () => {
      const { container } = renderCalendar({ view: 'agenda' });
      expect(
        container.querySelector('[data-slot="calendar-view"]')
      ).toBeTruthy();
    });

    it('renders event titles in agenda view', () => {
      renderCalendar({ view: 'agenda' });
      expect(screen.getAllByText('New York Meeting').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Sydney Standup').length).toBeGreaterThan(0);
    });

    it('renders the custom chip list (no RBC agenda table)', () => {
      const { container } = renderCalendar({ view: 'agenda' });
      // Our stacked list, not RBC's default agenda <table>.
      expect(
        container.querySelector('[data-slot="agenda-chip-list"]')
      ).toBeTruthy();
      expect(container.querySelector('table.rbc-agenda-table')).toBeFalsy();
    });

    it('renders events as scheduling chips in the list', () => {
      const { container } = renderCalendar({ view: 'agenda' });
      expect(
        container.querySelectorAll('[data-slot="scheduling-chip"]').length
      ).toBeGreaterThan(0);
    });

    it('calls onSelectEvent when a list chip is clicked', async () => {
      const user = userEvent.setup();
      const onSelectEvent = vi.fn();
      render(
        <CalendarView
          events={FIXTURE_EVENTS}
          view='agenda'
          onViewChange={vi.fn()}
          date={new Date('2024-06-15T00:00:00Z')}
          onDateChange={vi.fn()}
          onSelectEvent={onSelectEvent}
        />
      );
      await user.click(screen.getAllByText('New York Meeting')[0]);
      expect(onSelectEvent).toHaveBeenCalled();
    });
  });

  describe('scheduling chips', () => {
    it('renders week-view events as scheduling chips', () => {
      const { container } = renderCalendar({ view: 'week' });
      expect(
        container.querySelectorAll('[data-slot="scheduling-chip"]').length
      ).toBeGreaterThan(0);
    });

    it('renders sub-30-min events as a compact single-line chip', () => {
      // 15-minute event → compact variant (still a scheduling chip).
      const shortVM = toCalendarEventVM({
        ...RAW_NY,
        id: 200,
        title: 'Quick Sync',
        external_id: 'ext-200',
        start_time: '2024-06-15T14:00:00-04:00',
        end_time: '2024-06-15T14:15:00-04:00',
      });
      const { container } = renderCalendar({
        view: 'week',
        events: [shortVM],
      });
      const compact = container.querySelector(
        '[data-slot="scheduling-chip"][data-compact]'
      );
      expect(compact).toBeTruthy();
      expect(compact?.textContent).toContain('Quick Sync');
    });

    it('keeps the full chip (no compact) for events 30 min or longer', () => {
      // FIXTURE_EVENTS: NY is 60 min, SYD is exactly 30 min — neither compact.
      const { container } = renderCalendar({ view: 'week' });
      expect(
        container.querySelector('[data-slot="scheduling-chip"][data-compact]')
      ).toBeFalsy();
    });

    it('does NOT compact short events in the list view (full chip only)', () => {
      // Same 15-min event as above, but in the list view it keeps the full chip.
      const shortVM = toCalendarEventVM({
        ...RAW_NY,
        id: 201,
        title: 'Quick Sync',
        external_id: 'ext-201',
        start_time: '2024-06-15T14:00:00-04:00',
        end_time: '2024-06-15T14:15:00-04:00',
      });
      const { container } = renderCalendar({
        view: 'agenda',
        events: [shortVM],
      });
      expect(
        container.querySelector('[data-slot="scheduling-chip"]')
      ).toBeTruthy();
      expect(
        container.querySelector('[data-slot="scheduling-chip"][data-compact]')
      ).toBeFalsy();
    });
  });

  describe('month view — compact grid', () => {
    // Five events on the same day (2024-06-15) to exercise the 3 + "more" cap.
    const sameDayVMs: CalendarEventVM[] = Array.from({ length: 5 }, (_, i) => {
      const hour = String(9 + i).padStart(2, '0');
      return toCalendarEventVM({
        ...RAW_NY,
        id: 100 + i,
        title: `Event ${i + 1}`,
        external_id: `ext-100-${i}`,
        start_time: `2024-06-15T${hour}:00:00-04:00`,
        end_time: `2024-06-15T${hour}:30:00-04:00`,
      });
    });

    it('renders a compact month grid (not scheduling chips)', () => {
      const { container } = renderCalendar({ view: 'month' });
      expect(
        container.querySelector('[data-slot="month-chip-grid"]')
      ).toBeTruthy();
      // Compact items, not the tall chip, in the month grid.
      expect(
        container.querySelector('[data-slot="scheduling-chip"]')
      ).toBeFalsy();
    });

    it('caps a day at 3 events and shows a "+N more" button', () => {
      renderCalendar({ view: 'month', events: sameDayVMs });
      // First three render inline; 4th/5th collapse into "+2 more".
      expect(screen.getByText('Event 1')).toBeInTheDocument();
      expect(screen.getByText('Event 2')).toBeInTheDocument();
      expect(screen.getByText('Event 3')).toBeInTheDocument();
      expect(screen.queryByText('Event 4')).not.toBeInTheDocument();
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('opens a dialog with the full day when "+N more" is clicked', async () => {
      const user = userEvent.setup();
      renderCalendar({ view: 'month', events: sameDayVMs });

      await user.click(screen.getByText('+2 more'));

      const dialog = await screen.findByRole('dialog');
      // All five events appear in the dialog (the hidden ones included).
      expect(within(dialog).getByText('Event 4')).toBeInTheDocument();
      expect(within(dialog).getByText('Event 5')).toBeInTheDocument();
    });

    it('fires onSelectEvent when a compact month item is clicked', async () => {
      const user = userEvent.setup();
      const onSelectEvent = vi.fn();
      render(
        <CalendarView
          events={sameDayVMs}
          view='month'
          onViewChange={vi.fn()}
          date={new Date('2024-06-15T00:00:00Z')}
          onDateChange={vi.fn()}
          onSelectEvent={onSelectEvent}
        />
      );
      await user.click(screen.getByText('Event 1'));
      expect(onSelectEvent).toHaveBeenCalled();
    });
  });

  describe('per-event timezone labels', () => {
    it('shows the correct timezone label for a New York event (EDT, UTC-4)', () => {
      expect(VM_NY.timezoneLabel).toContain('UTC-4');
      expect(VM_NY.timezone).toBe('America/New_York');
    });

    it('shows the correct timezone label for a Sydney event (AEST, UTC+10)', () => {
      // In June Australia/Sydney is AEST = UTC+10 (no DST)
      expect(VM_SYD.timezoneLabel).toContain('UTC+10');
      expect(VM_SYD.timezone).toBe('Australia/Sydney');
    });

    it('renders different timezone labels for the two events', () => {
      expect(VM_NY.timezoneLabel).not.toBe(VM_SYD.timezoneLabel);
    });

    it('renders timezone labels in the calendar DOM (week chips)', () => {
      // Week/list chips carry the tz label; the compact month grid omits it.
      renderCalendar({ view: 'week' });
      const nyLabels = screen.getAllByText(VM_NY.timezoneLabel);
      const sydLabels = screen.getAllByText(VM_SYD.timezoneLabel);
      expect(nyLabels.length).toBeGreaterThan(0);
      expect(sydLabels.length).toBeGreaterThan(0);
    });
  });

  describe('view switch', () => {
    it('calls onViewChange when the user clicks the Week view tab', async () => {
      const user = userEvent.setup();
      const onViewChange = vi.fn();
      renderCalendar({ view: 'month', onViewChange });

      // The view switcher is our shadcn Tabs — triggers are role="tab".
      await user.click(screen.getByRole('tab', { name: /week/i }));

      expect(onViewChange).toHaveBeenCalledWith('week');
    });

    it('calls onViewChange when the user clicks the List/Agenda view tab', async () => {
      const user = userEvent.setup();
      const onViewChange = vi.fn();
      renderCalendar({ view: 'month', onViewChange });

      // We set `messages.agenda = 'List'` in CalendarView
      await user.click(screen.getByRole('tab', { name: /list/i }));

      expect(onViewChange).toHaveBeenCalledWith('agenda');
    });

    it('calls onViewChange when switching from week to month', async () => {
      const user = userEvent.setup();
      const onViewChange = vi.fn();
      renderCalendar({ view: 'week', onViewChange });

      await user.click(screen.getByRole('tab', { name: /month/i }));

      expect(onViewChange).toHaveBeenCalledWith('month');
    });

    it('renders the view switcher as a tablist with the active view selected', () => {
      renderCalendar({ view: 'week' });

      expect(screen.getByRole('tablist')).toBeTruthy();
      const weekTab = screen.getByRole('tab', { name: /week/i });
      expect(weekTab.getAttribute('aria-selected')).toBe('true');
    });

    it('does not call onDateChange when an external view switch re-renders with the same date prop', () => {
      const fixedDate = new Date('2024-06-15T00:00:00Z');
      const onDateChange = vi.fn();

      const { rerender } = render(
        <CalendarView
          events={FIXTURE_EVENTS}
          view='month'
          onViewChange={vi.fn()}
          date={fixedDate}
          onDateChange={onDateChange}
        />
      );

      // Switch to week view externally (parent re-renders with new view)
      rerender(
        <CalendarView
          events={FIXTURE_EVENTS}
          view='week'
          onViewChange={vi.fn()}
          date={fixedDate}
          onDateChange={onDateChange}
        />
      );

      // The date was not changed by the component — the same date is still in use
      expect(onDateChange).not.toHaveBeenCalled();
    });
  });

  describe('custom event renderer', () => {
    it('renders custom content when eventRenderer is provided (agenda view)', () => {
      // Use agenda view here because jsdom lacks DOM layout dimensions that RBC
      // needs to render events in month/week grid cells. Agenda view renders
      // events as table rows unconditionally, making it reliable in jsdom.
      const CustomRenderer = ({ event }: { event: CalendarEventVM }) => (
        <span data-testid='custom-event'>CUSTOM:{event.title}</span>
      );

      renderCalendar({
        view: 'agenda',
        eventRenderer: CustomRenderer,
      });

      const customElements = screen.getAllByTestId('custom-event');
      expect(customElements.length).toBeGreaterThan(0);
      expect(customElements[0].textContent).toContain('CUSTOM:');
    });
  });
});

// ---------------------------------------------------------------------------
// schedulingChipStatus mapping
// ---------------------------------------------------------------------------

describe('schedulingChipStatus', () => {
  it('maps confirmed/booked to "booked"', () => {
    expect(schedulingChipStatus('confirmed')).toBe('booked');
    expect(schedulingChipStatus('booked')).toBe('booked');
  });

  it('maps available/tentative through, and cancelled to "conflict"', () => {
    expect(schedulingChipStatus('available')).toBe('available');
    expect(schedulingChipStatus('tentative')).toBe('tentative');
    expect(schedulingChipStatus('cancelled')).toBe('conflict');
  });
});

// ---------------------------------------------------------------------------
// toCalendarEventVM unit tests
// ---------------------------------------------------------------------------

describe('toCalendarEventVM', () => {
  it('maps id, title, timezone from the raw event', () => {
    expect(VM_NY.id).toBe('1');
    expect(VM_NY.title).toBe('New York Meeting');
    expect(VM_NY.timezone).toBe('America/New_York');
  });

  it('produces JS Date boundaries that equal the UTC instant of the ISO string', () => {
    // 2024-06-15T14:00:00-04:00 = 2024-06-15T18:00:00Z
    expect(VM_NY.start.toISOString()).toBe('2024-06-15T18:00:00.000Z');
    expect(VM_NY.end.toISOString()).toBe('2024-06-15T19:00:00.000Z');
  });

  it('produces a correct zoned Luxon DateTime for the start', () => {
    // startDt should be in America/New_York zone
    expect(VM_NY.startDt.zoneName).toBe('America/New_York');
    expect(VM_NY.startDt.hour).toBe(14);
    expect(VM_NY.startDt.minute).toBe(0);
  });

  it('sets isRecurring and isRecurringException from the API shape', () => {
    expect(VM_NY.isRecurring).toBe(false);
    expect(VM_NY.isRecurringException).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildTimezoneLabel DST boundary tests
// ---------------------------------------------------------------------------

describe('buildTimezoneLabel — DST boundary (America/New_York)', () => {
  it('June event reflects EDT (UTC-4) — DST active', () => {
    // RAW_NY is 2024-06-15 in America/New_York — DST active, offset = -240 min
    expect(VM_NY.timezoneLabel).toContain('UTC-4');
    // The abbreviated name may be EDT in environments with full TZ data,
    // but the offset assertion is the load-bearing one regardless of env.
    expect(VM_NY.timezoneLabel).not.toContain('UTC-5');
  });

  it('November event reflects EST (UTC-5) — DST no longer active', () => {
    // RAW_NY_WINTER is 2024-11-15 in America/New_York — DST ended, offset = -300 min
    expect(VM_NY_WINTER.timezoneLabel).toContain('UTC-5');
    expect(VM_NY_WINTER.timezoneLabel).not.toContain('UTC-4');
  });

  it('summer and winter NY labels differ (DST transition captured correctly)', () => {
    expect(VM_NY.timezoneLabel).not.toBe(VM_NY_WINTER.timezoneLabel);
  });
});

// ---------------------------------------------------------------------------
// Recurrence VM tests
// ---------------------------------------------------------------------------

describe('toCalendarEventVM — recurrence', () => {
  it('sets isRecurring to true from is_recurring field', () => {
    expect(VM_RECURRING.isRecurring).toBe(true);
  });

  it('carries the typed recurrenceRule object (not a string)', () => {
    // Must be an object, not a JSON string
    expect(typeof VM_RECURRING.recurrenceRule).toBe('object');
    expect(VM_RECURRING.recurrenceRule).not.toBeNull();
  });

  it('recurrenceRule round-trips the original API object', () => {
    // The typed field must equal the raw input without any transformation
    expect(VM_RECURRING.recurrenceRule).toEqual(STUB_RECURRENCE_RULE);
  });

  it('recurrenceRule.frequency matches the stub', () => {
    expect(VM_RECURRING.recurrenceRule?.frequency).toBe('WEEKLY');
  });

  it('non-recurring event has undefined recurrenceRule', () => {
    expect(VM_NY.recurrenceRule).toBeUndefined();
  });
});
