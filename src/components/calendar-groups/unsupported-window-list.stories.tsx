import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { calendarGroupsSlotsAvailabilityWindowsListOptions } from '@/client/@tanstack/react-query.gen';
import type { GroupScopedAvailabilityWindow } from '@/client';
import { UnsupportedWindowList } from './unsupported-window-list';
import { GroupPermissionsProvider } from './group-permissions-provider';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GROUP_ID = 1;
const SLOT_ID = 10;
const CALENDAR_ID = 100;
const PAGE_LIMIT = { limit: 200 };

let nextId = 1;

function makeWindow(
  overrides: Partial<GroupScopedAvailabilityWindow> = {}
): GroupScopedAvailabilityWindow {
  return {
    id: nextId++,
    calendar_id: CALENDAR_ID,
    group_slot_id: SLOT_ID,
    start_time: '2024-06-01T13:00:00Z',
    end_time: '2024-06-01T15:00:00Z',
    timezone: 'America/Sao_Paulo',
    rrule_string: null,
    is_recurring: false,
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
  title: 'Components/CalendarGroups/UnsupportedWindowList',
  component: UnsupportedWindowList,
  tags: ['autodocs'],
} satisfies Meta<typeof UnsupportedWindowList>;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

// A calendar with only weekly-representable windows: the list renders
// nothing (see slot-roster.tsx, which mounts this next to
// GroupWindowGrid -- the grid's own story shows that case).
export const NoUnrepresentableRows: Story = {
  render: () => {
    const client = makeSeededQueryClient([
      makeWindow({
        rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
        is_recurring: true,
        start_time: '2024-01-02T09:00:00Z',
        end_time: '2024-01-02T17:00:00Z',
      }),
    ]);
    return (
      <QueryClientProvider client={client}>
        <GroupPermissionsProvider role='admin' ownedCalendarIds={new Set()}>
          <UnsupportedWindowList
            groupId={GROUP_ID}
            slotId={SLOT_ID}
            calendarId={CALENDAR_ID}
          />
        </GroupPermissionsProvider>
      </QueryClientProvider>
    );
  },
};

export const Populated: Story = {
  render: () => {
    const client = makeSeededQueryClient([
      makeWindow({
        start_time: '2024-06-01T13:00:00Z',
        end_time: '2024-06-01T15:00:00Z',
        rrule_string: null,
        is_recurring: false,
      }),
      makeWindow({
        start_time: '2024-01-01T09:00:00Z',
        end_time: '2024-01-01T10:00:00Z',
        rrule_string: 'FREQ=DAILY',
        is_recurring: true,
      }),
    ]);
    return (
      <QueryClientProvider client={client}>
        <GroupPermissionsProvider role='admin' ownedCalendarIds={new Set()}>
          <UnsupportedWindowList
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
      makeWindow({
        start_time: '2024-01-01T09:00:00Z',
        end_time: '2024-01-01T10:00:00Z',
        rrule_string: 'FREQ=DAILY',
        is_recurring: true,
      }),
    ]);
    return (
      <QueryClientProvider client={client}>
        <GroupPermissionsProvider role='member' ownedCalendarIds={new Set()}>
          <UnsupportedWindowList
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
  ...Populated,
  globals: { viewport: { value: 'mobile' } },
};
