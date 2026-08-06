import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { groupAvailabilityPreviewQueryKey } from '@/hooks/calendar-groups/use-group-availability-preview';
import type { CalendarGroupRangeAvailability } from '@/client';
import { GroupAvailabilityPreview } from './group-availability-preview';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GROUP_ID = 1;
const SLOT_ID = 10;
const CALENDAR_ID = 100;
const TIMEZONE = 'UTC';
const START_DATE = '2026-08-10';
const END_DATE = '2026-08-16';

// Matches GroupAvailabilityPreview's own `buildDayRanges` -- one full-day
// range per day between START_DATE and END_DATE, in TIMEZONE.
const DAY_START_TIMES = [
  '2026-08-10T00:00:00.000Z',
  '2026-08-11T00:00:00.000Z',
  '2026-08-12T00:00:00.000Z',
  '2026-08-13T00:00:00.000Z',
  '2026-08-14T00:00:00.000Z',
  '2026-08-15T00:00:00.000Z',
  '2026-08-16T00:00:00.000Z',
];

function dayRange(index: number) {
  return {
    start_time: DAY_START_TIMES[index]!,
    end_time: DAY_START_TIMES[index + 1] ?? '2026-08-17T00:00:00.000Z',
  };
}

function makeSeededQueryClient(
  results: CalendarGroupRangeAvailability[]
): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(
    groupAvailabilityPreviewQueryKey({
      groupId: GROUP_ID,
      slotId: SLOT_ID,
      calendarId: CALENDAR_ID,
      startDate: START_DATE,
      endDate: END_DATE,
      timezone: TIMEZONE,
    }),
    results
  );
  return client;
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/CalendarGroups/GroupAvailabilityPreview',
  component: GroupAvailabilityPreview,
  tags: ['autodocs'],
  args: {
    groupId: GROUP_ID,
    slotId: SLOT_ID,
    calendarId: CALENDAR_ID,
    calendarName: 'Dr. Reyes',
    initialStartDate: START_DATE,
    initialEndDate: END_DATE,
    initialTimezone: TIMEZONE,
  },
} satisfies Meta<typeof GroupAvailabilityPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

// Default mount: collapsed, no query cache seeded at all -- proves the
// strip renders (and issues nothing) without ever opening.
export const Collapsed: Story = {
  render: (args) => (
    <QueryClientProvider client={new QueryClient()}>
      <GroupAvailabilityPreview {...args} />
    </QueryClientProvider>
  ),
};

// A calendar configured Tuesdays and Thursdays over the coming week (spec
// UC-7's acceptance scenario): free on 08-11 and 08-13, not free every other
// day -- rendered distinctly.
export const MixedRange: Story = {
  args: { initialOpen: true },
  render: (args) => {
    const results: CalendarGroupRangeAvailability[] = DAY_START_TIMES.slice(
      0,
      7
    ).map((_, index) => {
      const isTuesdayOrThursday = index === 1 || index === 3; // 08-11, 08-13
      return {
        ...dayRange(index),
        slots: [
          {
            slot_id: SLOT_ID,
            available_calendar_ids: isTuesdayOrThursday ? [CALENDAR_ID] : [],
            required_count: 1,
            is_bookable: isTuesdayOrThursday,
          },
        ],
      };
    });
    return (
      <QueryClientProvider client={makeSeededQueryClient(results)}>
        <GroupAvailabilityPreview {...args} />
      </QueryClientProvider>
    );
  },
};

// A Saturday window on a calendar whose base availability excludes Saturday
// (spec UC-7's motivating scenario) -- never free anywhere in the range.
// Renders the explicit "not available" answer, not an error.
export const EmptyRange: Story = {
  args: { initialOpen: true },
  render: (args) => {
    const results: CalendarGroupRangeAvailability[] = DAY_START_TIMES.slice(
      0,
      7
    ).map((_, index) => ({
      ...dayRange(index),
      slots: [
        {
          slot_id: SLOT_ID,
          available_calendar_ids: [],
          required_count: 1,
          is_bookable: false,
        },
      ],
    }));
    return (
      <QueryClientProvider client={makeSeededQueryClient(results)}>
        <GroupAvailabilityPreview {...args} />
      </QueryClientProvider>
    );
  },
};

export const Mobile: Story = {
  ...MixedRange,
  globals: { viewport: { value: 'mobile' } },
};
