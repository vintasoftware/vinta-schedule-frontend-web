'use client';

/**
 * Storybook stories for the CalendarView + CalendarScopePicker.
 *
 * Renders the same fixture events across list/month/week with timezone-correct
 * times and a (non-wired) scope picker.
 *
 * The view switcher demo wraps CalendarView in a stateful shell so you can
 * toggle views and navigate dates interactively inside Storybook.
 */

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CalendarView } from './calendar-view';
import { CalendarScopePicker } from './calendar-scope-picker';
import type { CalendarEventVM } from './event-vm';
import { toCalendarEventVM } from './event-vm';
import type { CalendarEvent } from '@/client';
import { VStack, HStack, Text } from '@/components/layout';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Fixture events — two events in different IANA timezones
// ---------------------------------------------------------------------------

/** Minimal stub for the required ParentEvent shape (non-recurring events). */
const STUB_PARENT = {
  id: 0,
  title: '',
  external_id: '',
  start_time: '2024-01-01T00:00:00Z',
  end_time: '2024-01-01T00:00:00Z',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
} as const;

const RAW_EVENTS: CalendarEvent[] = [
  {
    id: 1,
    title: 'Design Review',
    description: 'Weekly design review',
    start_time: '2024-06-17T10:00:00-04:00', // Mon, America/New_York EDT
    end_time: '2024-06-17T11:30:00-04:00',
    timezone: 'America/New_York',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    external_id: 'evt-1',
    external_attendances: [],
    attendances: [],
    resource_allocations: [],
    parent_recurring_object: STUB_PARENT,
    is_recurring: false,
    is_recurring_instance: false,
  },
  {
    id: 2,
    title: 'Sydney Standup',
    description: 'Daily standup',
    start_time: '2024-06-17T09:00:00+10:00', // Mon, Australia/Sydney AEST
    end_time: '2024-06-17T09:30:00+10:00',
    timezone: 'Australia/Sydney',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    external_id: 'evt-2',
    external_attendances: [],
    attendances: [],
    resource_allocations: [],
    parent_recurring_object: STUB_PARENT,
    is_recurring: false,
    is_recurring_instance: false,
  },
  {
    id: 3,
    title: 'Sprint Planning',
    description: 'Bi-weekly sprint planning',
    start_time: '2024-06-18T14:00:00-04:00', // Tue, America/New_York EDT
    end_time: '2024-06-18T16:00:00-04:00',
    timezone: 'America/New_York',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    external_id: 'evt-3',
    external_attendances: [],
    attendances: [],
    resource_allocations: [],
    parent_recurring_object: STUB_PARENT,
    is_recurring: true,
    is_recurring_instance: false,
  },
  {
    id: 4,
    title: 'London Check-in',
    start_time: '2024-06-19T09:00:00+01:00', // Wed, Europe/London BST
    end_time: '2024-06-19T09:45:00+01:00',
    timezone: 'Europe/London',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    external_id: 'evt-4',
    external_attendances: [],
    attendances: [],
    resource_allocations: [],
    parent_recurring_object: STUB_PARENT,
    is_recurring: false,
    is_recurring_instance: false,
  },
];

const FIXTURE_EVENTS: CalendarEventVM[] = RAW_EVENTS.map((e) =>
  toCalendarEventVM(e)
);

// Reference date: week of June 17 2024 (Mon–Sun)
const ANCHOR_DATE = new Date('2024-06-17T12:00:00Z');

// ---------------------------------------------------------------------------
// Scaffold calendars for the scope picker
// ---------------------------------------------------------------------------

const CALENDARS = [
  { id: 1, name: 'Personal' },
  { id: 2, name: 'Work' },
  { id: 3, name: 'Shared' },
];

// ---------------------------------------------------------------------------
// Interactive shell — wraps CalendarView with local state so the story is
// self-contained and navigable.
// ---------------------------------------------------------------------------

function CalendarDemo({
  initialView = 'week',
}: {
  initialView?: 'month' | 'week' | 'agenda';
}) {
  const [view, setView] = React.useState<'month' | 'week' | 'agenda'>(
    initialView
  );
  const [date, setDate] = React.useState<Date>(ANCHOR_DATE);
  const [scopeCalendarId, setScopeCalendarId] = React.useState<number | null>(
    null
  );

  // When a specific calendar is selected, filter events (scaffold — just
  // demonstrates the picker shape; real filtering wired in Phase 15).
  const visibleEvents =
    scopeCalendarId === null
      ? FIXTURE_EVENTS
      : FIXTURE_EVENTS.filter(
          (e) => e.calendarId === scopeCalendarId || e.calendarId === undefined
        );

  return (
    <VStack className='h-screen p-4' gap={4}>
      {/* Toolbar row: scope picker + view info */}
      <HStack justify='between' align='center'>
        <CalendarScopePicker
          calendars={CALENDARS}
          value={scopeCalendarId}
          onChange={setScopeCalendarId}
        />
        <Text size='sm' color='muted-foreground'>
          Showing {visibleEvents.length} event
          {visibleEvents.length !== 1 ? 's' : ''}
        </Text>
      </HStack>

      {/* Calendar */}
      <CalendarView
        events={visibleEvents}
        view={view}
        onViewChange={setView}
        date={date}
        onDateChange={setDate}
        className='flex-1'
        minHeight={500}
      />
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Custom event renderer demo — shows how Phase 18 overlay hook works
// ---------------------------------------------------------------------------

function StatusBadgeEventContent({
  event,
}: {
  event: CalendarEventVM;
}): React.ReactElement {
  return (
    <span className='flex min-w-0 items-center gap-1 leading-tight'>
      <span className='truncate text-xs font-medium'>{event.title}</span>
      {event.isRecurring && (
        <Badge
          variant='secondary'
          className='shrink-0 px-1 py-0 text-[10px] leading-none'
        >
          recurring
        </Badge>
      )}
    </span>
  );
}

function CalendarWithCustomRenderer() {
  const [view, setView] = React.useState<'month' | 'week' | 'agenda'>('week');
  const [date, setDate] = React.useState<Date>(ANCHOR_DATE);

  return (
    <VStack className='h-screen p-4' gap={4}>
      <Text size='sm' color='muted-foreground'>
        Custom renderer demo — recurring events show a badge (Phase 18 hook
        point).
      </Text>
      <CalendarView
        events={FIXTURE_EVENTS}
        view={view}
        onViewChange={setView}
        date={date}
        onDateChange={setDate}
        eventRenderer={StatusBadgeEventContent}
        className='flex-1'
        minHeight={500}
      />
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/CalendarView',
  component: CalendarView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CalendarView>;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Week view — default. Timezone labels visible in event blocks. */
export const WeekView: Story = {
  render: () => <CalendarDemo initialView='week' />,
};

/** Month view — compact grid over the same fixture events. */
export const MonthView: Story = {
  render: () => <CalendarDemo initialView='month' />,
};

/**
 * List / Agenda view — the most readable for mixed-timezone events.
 * Note: RBC's agenda view defaults to a 30-day window from the anchor date.
 */
export const ListView: Story = {
  render: () => <CalendarDemo initialView='agenda' />,
};

/**
 * Custom renderer hook point — demonstrates how Phase 18 will inject
 * group-booking / availability overlays without forking CalendarView.
 */
export const CustomEventRenderer: Story = {
  render: () => <CalendarWithCustomRenderer />,
};

/** Mobile viewport — week view at 375px. */
export const Mobile: Story = {
  render: () => <CalendarDemo initialView='week' />,
  globals: { viewport: { value: 'mobile' } },
};
