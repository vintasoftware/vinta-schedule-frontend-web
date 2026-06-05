import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { calendarGroupsListQueryKey } from '@/client/@tanstack/react-query.gen';
import type { Calendar, CalendarGroup } from '@/client';
import { BookGroupButton } from './book-group-button';

// ---------------------------------------------------------------------------
// Fixtures — a clinic group: "Nurses" (pick 2 of 3) + "Room" (pick 1 of 2).
// ---------------------------------------------------------------------------

function cal(id: number, name: string): Calendar {
  return {
    id,
    name,
    email: `c${id}@x.com`,
    external_id: `e${id}`,
    provider: 'internal',
    calendar_type: 'personal',
    capacity: null,
    is_active: true,
  } as Calendar;
}

const GROUP: CalendarGroup = {
  id: 7,
  name: 'Clinic',
  slots: [
    {
      id: 1,
      name: 'Nurses',
      required_count: 2,
      calendars: [cal(10, 'Nurse A'), cal(11, 'Nurse B'), cal(12, 'Nurse C')],
    },
    {
      id: 2,
      name: 'Room',
      required_count: 1,
      calendars: [cal(20, 'Room 1'), cal(21, 'Room 2')],
    },
  ],
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

/**
 * Seed the query cache so useCalendarGroups resolves the fixture group without
 * a backend call.
 */
function makePrimedClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(calendarGroupsListQueryKey(), {
    count: 1,
    results: [GROUP],
  });
  return client;
}

const meta: Meta<typeof BookGroupButton> = {
  title: 'Calendar Groups/BookGroupButton',
  component: BookGroupButton,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makePrimedClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof BookGroupButton>;

/**
 * The default "Book a group" button. Click it to open the GroupBookingFlow
 * dialog and exercise the group picker + slot pickers.
 */
export const Default: Story = {};
