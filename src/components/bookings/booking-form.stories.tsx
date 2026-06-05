import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingFormDialog } from './booking-form';
import { ConflictSurface, type CalendarConflict } from './conflict-surface';

// ---------------------------------------------------------------------------
// Query wrapper
// ---------------------------------------------------------------------------

function makeStoryQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function QueryWrapper({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeStoryQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Story wrappers — open state is controlled so close button works.
// ---------------------------------------------------------------------------

function DefaultStory() {
  const [open, setOpen] = React.useState(true);
  return (
    <QueryWrapper>
      <BookingFormDialog open={open} onOpenChange={setOpen} />
    </QueryWrapper>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/Bookings/BookingFormDialog',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default — the booking form ready to fill in (calendars will load from API). */
export const Default: Story = {
  render: () => <DefaultStory />,
};

// ---------------------------------------------------------------------------
// Conflict-surfaced state story
//
// Shows the ConflictSurface as rendered inside a booking flow — used by phases
// 17/18/21 which reuse this component. Fixtures include a nearest-free window
// and a calendar without one, simulating a typical multi-calendar conflict.
// ---------------------------------------------------------------------------

const CONFLICT_WITH_FREE_WINDOW: CalendarConflict = {
  calendarId: 1,
  calendarName: 'Personal Calendar',
  conflictingWindows: [
    {
      id: 10,
      reason: 'blocked_time',
      reason_description: 'Existing blocked time',
      start_time: '2024-06-15T09:00:00-04:00',
      end_time: '2024-06-15T10:00:00-04:00',
    },
  ],
  nearestFreeWindow: {
    id: 20,
    start_time: '2024-06-15T11:00:00-04:00',
    end_time: '2024-06-15T12:00:00-04:00',
    can_book_partially: false,
  },
};

const CONFLICT_NO_FREE_WINDOW: CalendarConflict = {
  calendarId: 2,
  calendarName: 'Work Calendar',
  conflictingWindows: [
    {
      id: 11,
      reason: 'calendar_event',
      reason_description: 'Team standup',
      start_time: '2024-06-15T14:00:00-04:00',
      end_time: '2024-06-15T15:00:00-04:00',
    },
  ],
  nearestFreeWindow: null,
};

/**
 * ConflictSurfaced — the warn-but-allow-override panel shown when the
 * availability check detects a conflict. This is the shared surface reused
 * by phases 17/18/21. Fixtures include a nearest-free window (Personal) and
 * no nearest-free window (Work).
 */
export const ConflictSurfaced: Story = {
  render: () => (
    <QueryWrapper>
      <ConflictSurface
        conflicts={[CONFLICT_WITH_FREE_WINDOW, CONFLICT_NO_FREE_WINDOW]}
        onProceed={() => {}}
        onAdjust={() => {}}
        isPending={false}
      />
    </QueryWrapper>
  ),
};
