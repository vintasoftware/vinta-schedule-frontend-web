import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { CalendarEvent } from '@/client';
import { BookingConfirmation } from './booking-confirmation';

const EVENT: CalendarEvent = {
  id: 1,
  title: 'Appointment',
  start_time: '2026-03-02T15:00:00.000Z',
  end_time: '2026-03-02T15:30:00.000Z',
  timezone: 'America/New_York',
  created: '2026-03-01T00:00:00.000Z',
  modified: '2026-03-01T00:00:00.000Z',
  external_id: 'evt-1',
  external_attendances: [],
  attendances: [],
  resource_allocations: [],
  group_selections: [],
  parent_recurring_object: {
    id: 0,
    title: '',
    external_id: '',
    start_time: '2026-03-01T00:00:00.000Z',
    end_time: '2026-03-01T00:00:00.000Z',
    created: '2026-03-01T00:00:00.000Z',
    modified: '2026-03-01T00:00:00.000Z',
  },
  is_recurring_instance: false,
  is_recurring: false,
};

const meta = {
  title: 'Components/PublicBooking/BookingConfirmation',
  component: BookingConfirmation,
  tags: ['autodocs'],
  args: {
    event: EVENT,
    timezone: 'America/New_York',
  },
} satisfies Meta<typeof BookingConfirmation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
