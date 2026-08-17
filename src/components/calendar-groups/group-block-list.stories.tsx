import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { calendarGroupsSlotsBlockedTimesListOptions } from '@/client/@tanstack/react-query.gen';
import type { GroupScopedBlockedTime } from '@/client';
import { GroupBlockList } from './group-block-list';
import { GroupPermissionsProvider } from './group-permissions-provider';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GROUP_ID = 1;
const SLOT_ID = 10;
const CALENDAR_ID = 100;
const PAGE_LIMIT = { limit: 200 };

let nextId = 1;

function makeBlock(
  overrides: Partial<GroupScopedBlockedTime> = {}
): GroupScopedBlockedTime {
  return {
    id: nextId++,
    calendar_id: CALENDAR_ID,
    group_slot_id: SLOT_ID,
    start_time: '2026-09-08T09:00:00-03:00',
    end_time: '2026-09-08T17:00:00-03:00',
    timezone: 'America/Sao_Paulo',
    reason: '',
    rrule_string: null,
    is_recurring: false,
    created: '2026-01-01T00:00:00Z',
    modified: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeSeededQueryClient(blocks: GroupScopedBlockedTime[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(
    calendarGroupsSlotsBlockedTimesListOptions({
      path: { group_id: GROUP_ID, slot_id: SLOT_ID },
      query: PAGE_LIMIT,
    }).queryKey,
    { count: blocks.length, results: blocks }
  );
  return client;
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/CalendarGroups/GroupBlockList',
  component: GroupBlockList,
  tags: ['autodocs'],
} satisfies Meta<typeof GroupBlockList>;

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
        <GroupPermissionsProvider
          permissions={['organizations.manage_members']}
          ownedCalendarIds={new Set()}
        >
          <GroupBlockList
            groupId={GROUP_ID}
            slotId={SLOT_ID}
            calendarId={CALENDAR_ID}
            calendarName='Dr. Reyes'
          />
        </GroupPermissionsProvider>
      </QueryClientProvider>
    );
  },
};

export const Populated: Story = {
  render: () => {
    const client = makeSeededQueryClient([
      makeBlock({
        start_time: '2026-09-08T09:00:00-03:00',
        end_time: '2026-09-08T17:00:00-03:00',
        reason: 'Conference',
      }),
      makeBlock({
        start_time: '2026-09-10T09:00:00-03:00',
        end_time: '2026-09-10T17:00:00-03:00',
        reason: 'Conference',
      }),
      makeBlock({
        start_time: '2026-09-01T00:00:00-03:00',
        end_time: '2026-09-01T23:59:59-03:00',
        rrule_string: 'FREQ=WEEKLY;BYDAY=MO',
        is_recurring: true,
        reason: 'Admin day',
      }),
    ]);
    return (
      <QueryClientProvider client={client}>
        <GroupPermissionsProvider
          permissions={['organizations.manage_members']}
          ownedCalendarIds={new Set()}
        >
          <GroupBlockList
            groupId={GROUP_ID}
            slotId={SLOT_ID}
            calendarId={CALENDAR_ID}
            calendarName='Dr. Reyes'
          />
        </GroupPermissionsProvider>
      </QueryClientProvider>
    );
  },
};

export const ReadOnly: Story = {
  render: () => {
    const client = makeSeededQueryClient([makeBlock({ reason: 'Conference' })]);
    return (
      <QueryClientProvider client={client}>
        <GroupPermissionsProvider permissions={[]} ownedCalendarIds={new Set()}>
          <GroupBlockList
            groupId={GROUP_ID}
            slotId={SLOT_ID}
            calendarId={CALENDAR_ID}
            calendarName='Dr. Reyes'
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
