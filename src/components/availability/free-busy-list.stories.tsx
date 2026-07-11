/**
 * Storybook stories for FreeBusyList.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FreeBusyList } from './free-busy-list';

const meta = {
  title: 'Availability/FreeBusyList',
  component: FreeBusyList,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof FreeBusyList>;

export default meta;
type Story = StoryObj;

const FREE_WINDOWS = [
  {
    id: 1,
    start_time: '2025-06-01T09:00:00',
    end_time: '2025-06-01T12:00:00',
    can_book_partially: true,
  },
  {
    id: 2,
    start_time: '2025-06-02T14:00:00',
    end_time: '2025-06-02T17:00:00',
    can_book_partially: false,
  },
];

const BUSY_WINDOWS = [
  {
    id: 3,
    start_time: '2025-06-01T13:00:00',
    end_time: '2025-06-01T14:00:00',
    reason_description: 'Team standup',
  },
  {
    id: 4,
    start_time: '2025-06-03T10:00:00',
    end_time: '2025-06-03T11:00:00',
    reason_description: 'Blocked time',
  },
];

/** Default: free + busy windows mixed. */
export const Default: Story = {
  args: {
    freeWindows: FREE_WINDOWS,
    busyWindows: BUSY_WINDOWS,
    isLoading: false,
    isError: false,
    calendarLabel: 'Work Calendar',
  },
};

/** Loading state. */
export const Loading: Story = {
  args: {
    freeWindows: [],
    busyWindows: [],
    isLoading: true,
    isError: false,
  },
};

/** Error state. */
export const ErrorState: Story = {
  args: {
    freeWindows: [],
    busyWindows: [],
    isLoading: false,
    isError: true,
  },
};

/** Empty state — no windows returned. */
export const Empty: Story = {
  args: {
    freeWindows: [],
    busyWindows: [],
    isLoading: false,
    isError: false,
  },
};

/** Free only. */
export const FreeOnly: Story = {
  args: {
    freeWindows: FREE_WINDOWS,
    busyWindows: [],
    isLoading: false,
    isError: false,
  },
};

/** Mobile viewport. */
export const Mobile: Story = {
  args: {
    freeWindows: FREE_WINDOWS,
    busyWindows: BUSY_WINDOWS,
    isLoading: false,
    isError: false,
    calendarLabel: 'Work Calendar',
  },
  globals: {
    viewport: { value: 'mobile' },
  },
};
