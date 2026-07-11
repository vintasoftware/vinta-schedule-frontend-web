import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RescheduleDialog } from './reschedule-dialog';
import { DateTime } from 'luxon';
import type { CalendarEventVM } from '@/components/calendar/event-vm';
import type { CalendarEvent } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRaw(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 1,
    title: 'Team Meeting',
    start_time: '2024-06-15T09:00:00-04:00',
    end_time: '2024-06-15T10:00:00-04:00',
    timezone: 'America/New_York',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    external_id: 'ext-1',
    external_attendances: [],
    attendances: [],
    resource_allocations: [],
    parent_recurring_object: {
      id: 0,
      title: '',
      external_id: '',
      start_time: '2024-01-01T00:00:00Z',
      end_time: '2024-01-01T00:00:00Z',
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
    },
    is_recurring: false,
    is_recurring_instance: false,
    ...overrides,
  };
}

function makeEventVM(
  overrides: Partial<CalendarEventVM> = {}
): CalendarEventVM {
  const raw = makeRaw();
  const zone = 'America/New_York';
  const startDt = DateTime.fromISO(raw.start_time, { zone });
  const endDt = DateTime.fromISO(raw.end_time, { zone });
  return {
    id: String(raw.id),
    title: raw.title,
    start: startDt.toJSDate(),
    end: endDt.toJSDate(),
    startDt,
    endDt,
    timezone: zone,
    timezoneLabel: 'EDT (UTC-4)',
    calendarId: 1,
    isRecurring: false,
    isRecurringException: false,
    status: 'confirmed',
    _raw: raw,
    ...overrides,
  };
}

const NON_RECURRING_EVENT = makeEventVM();

const RECURRING_EVENT = makeEventVM({
  isRecurring: true,
  _raw: makeRaw({ is_recurring: true, is_recurring_instance: true }),
});

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/Bookings/RescheduleDialog',
  component: RescheduleDialog,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: () => {},
  },
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof RescheduleDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Non-recurring event — simple reschedule form, no scope prompt. */
export const NonRecurring: Story = {
  args: {
    event: NON_RECURRING_EVENT,
  },
};

/** Recurring event — the scope prompt will appear after the form is submitted. */
export const Recurring: Story = {
  args: {
    event: RECURRING_EVENT,
  },
};

/** Dialog with no event (renders nothing). */
export const NoEvent: Story = {
  args: {
    event: null,
  },
};
