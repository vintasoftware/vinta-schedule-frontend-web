import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BookingProgress } from './booking-progress';

const meta = {
  title: 'Components/PublicBooking/BookingProgress',
  component: BookingProgress,
  tags: ['autodocs'],
} satisfies Meta<typeof BookingProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The single-calendar book flow — two steps. */
export const CalendarBookFirstStep: Story = {
  args: { steps: ['Pick a time', 'Your details'], currentStep: 0 },
};

export const CalendarBookSecondStep: Story = {
  args: { steps: ['Pick a time', 'Your details'], currentStep: 1 },
};

/** The group book flow — one extra step to choose a calendar per slot. */
export const GroupBookStep: Story = {
  args: {
    steps: ['Pick a time', 'Choose calendars', 'Your details'],
    currentStep: 1,
  },
};

/** The reschedule flow — its own, shorter list; no "Your details" step. */
export const RescheduleStep: Story = {
  args: { steps: ['Pick a new time', 'Confirm'], currentStep: 0 },
};
