import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { calendarGroupsSlotsAvailabilityWindowsListOptions } from '@/client/@tanstack/react-query.gen';
import type { GroupScopedAvailabilityWindow } from '@/client';
import { GroupWindowGrid } from './group-window-grid';
import { GroupPermissionsProvider } from './group-permissions-provider';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GROUP_ID = 1;
const SLOT_ID = 10;
const CALENDAR_ID = 100;
const PAGE_LIMIT = { limit: 200 };

let nextId = 1;

function makeWeeklyWindow(
  overrides: Partial<GroupScopedAvailabilityWindow> = {}
): GroupScopedAvailabilityWindow {
  return {
    id: nextId++,
    calendar_id: CALENDAR_ID,
    group_slot_id: SLOT_ID,
    start_time: '2024-01-02T09:00:00Z', // Tuesday
    end_time: '2024-01-02T17:00:00Z',
    timezone: 'America/Sao_Paulo',
    rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
    is_recurring: true,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeSeededQueryClient(windows: GroupScopedAvailabilityWindow[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(
    calendarGroupsSlotsAvailabilityWindowsListOptions({
      path: { group_id: GROUP_ID, slot_id: SLOT_ID },
      query: PAGE_LIMIT,
    }).queryKey,
    { count: windows.length, results: windows }
  );
  return client;
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/CalendarGroups/GroupWindowGrid',
  component: GroupWindowGrid,
  tags: ['autodocs'],
} satisfies Meta<typeof GroupWindowGrid>;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Empty: Story = {
  render: () => {
    const client = makeSeededQueryClient([]);
    return (
      <QueryClientProvider client={client}>
        <GroupPermissionsProvider role='admin' ownedCalendarIds={new Set()}>
          <GroupWindowGrid
            groupId={GROUP_ID}
            slotId={SLOT_ID}
            calendarId={CALENDAR_ID}
          />
        </GroupPermissionsProvider>
      </QueryClientProvider>
    );
  },
};

export const Configured: Story = {
  render: () => {
    const client = makeSeededQueryClient([
      makeWeeklyWindow({
        start_time: '2024-01-02T09:00:00Z', // Tuesday
        end_time: '2024-01-02T17:00:00Z',
        rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
      }),
      makeWeeklyWindow({
        start_time: '2024-01-04T09:00:00Z', // Thursday
        end_time: '2024-01-04T17:00:00Z',
        rrule_string: 'FREQ=WEEKLY;BYDAY=TH',
      }),
    ]);
    return (
      <QueryClientProvider client={client}>
        <GroupPermissionsProvider role='admin' ownedCalendarIds={new Set()}>
          <GroupWindowGrid
            groupId={GROUP_ID}
            slotId={SLOT_ID}
            calendarId={CALENDAR_ID}
          />
        </GroupPermissionsProvider>
      </QueryClientProvider>
    );
  },
};

// A calendar an integration configured through the public API (spec UC-4):
// one weekly window the grid can show, plus a one-off and a multi-day BYDAY
// rule the grid can't represent. Only the weekly row renders here --
// unsupported-window-list.tsx renders the other two, side by side in
// slot-roster.tsx.
export const WithUnrepresentableRowsPresent: Story = {
  name: 'With unrepresentable rows (grid shows only the weekly row)',
  render: () => {
    const client = makeSeededQueryClient([
      makeWeeklyWindow({
        start_time: '2024-01-02T09:00:00Z',
        end_time: '2024-01-02T17:00:00Z',
        rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
      }),
      makeWeeklyWindow({
        start_time: '2024-06-01T09:00:00Z',
        end_time: '2024-06-01T12:00:00Z',
        rrule_string: null,
        is_recurring: false,
      }),
      makeWeeklyWindow({
        start_time: '2024-01-01T13:00:00Z', // Monday
        end_time: '2024-01-01T15:00:00Z',
        rrule_string: 'FREQ=WEEKLY;BYDAY=MO,WE',
      }),
    ]);
    return (
      <QueryClientProvider client={client}>
        <GroupPermissionsProvider role='admin' ownedCalendarIds={new Set()}>
          <GroupWindowGrid
            groupId={GROUP_ID}
            slotId={SLOT_ID}
            calendarId={CALENDAR_ID}
          />
        </GroupPermissionsProvider>
      </QueryClientProvider>
    );
  },
};

export const ReadOnly: Story = {
  render: () => {
    const client = makeSeededQueryClient([
      makeWeeklyWindow({
        start_time: '2024-01-02T09:00:00Z',
        end_time: '2024-01-02T17:00:00Z',
        rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
      }),
    ]);
    return (
      <QueryClientProvider client={client}>
        <GroupPermissionsProvider role='member' ownedCalendarIds={new Set()}>
          <GroupWindowGrid
            groupId={GROUP_ID}
            slotId={SLOT_ID}
            calendarId={CALENDAR_ID}
          />
        </GroupPermissionsProvider>
      </QueryClientProvider>
    );
  },
};

export const Mobile: Story = {
  ...Configured,
  globals: { viewport: { value: 'mobile' } },
};
