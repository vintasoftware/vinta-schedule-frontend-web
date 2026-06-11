import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ConflictSurface, type CalendarConflict } from './conflict-surface';

// ---------------------------------------------------------------------------
// Fixtures
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

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/Bookings/ConflictSurface',
  component: ConflictSurface,
  parameters: {
    layout: 'centered',
  },
  args: {
    onProceed: () => {},
    onAdjust: () => {},
    isPending: false,
  },
} satisfies Meta<typeof ConflictSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Single conflict with a nearest free window suggestion. */
export const SingleConflict: Story = {
  args: {
    conflicts: [CONFLICT_WITH_FREE_WINDOW],
  },
};

/** Conflict without a free window available. */
export const ConflictNoFreeWindow: Story = {
  args: {
    conflicts: [CONFLICT_NO_FREE_WINDOW],
  },
};

/** Multiple calendars have conflicts. */
export const MultipleConflicts: Story = {
  args: {
    conflicts: [CONFLICT_WITH_FREE_WINDOW, CONFLICT_NO_FREE_WINDOW],
  },
};

/** Pending state — buttons are disabled with "Booking…" label. */
export const Pending: Story = {
  args: {
    conflicts: [CONFLICT_WITH_FREE_WINDOW],
    isPending: true,
  },
};
