import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  appointmentTypesSlotsAvailabilityWindowsListOptions,
  appointmentTypesSlotsBlockedTimesListOptions,
  appointmentTypesSlotsQuotaRulesListOptions,
} from '@/client/@tanstack/react-query.gen';
import type {
  AppointmentTypeSlot,
  AppointmentTypeScopedAvailabilityWindow,
  AppointmentTypeScopedBlockedTime,
  AppointmentTypeScopedQuotaRule,
} from '@/client';
import { SlotRoster } from './slot-roster';
import { AppointmentTypePermissionsProvider } from './appointment-type-permissions-provider';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const APPOINTMENT_TYPE_ID = 1;

const SLOT: AppointmentTypeSlot = {
  id: 10,
  name: 'Surgeon',
  required_count: 1,
  calendars: [
    {
      id: 100,
      name: 'Dr. Smith',
      email: 'smith@example.com',
      external_id: 'ext-100',
      provider: 'google',
      calendar_type: 'personal',
    },
    {
      id: 101,
      name: 'Recovery Room A',
      email: 'room-a@example.com',
      external_id: 'ext-101',
      provider: 'google',
      calendar_type: 'resource',
    },
  ],
  pools: [],
};

const EMPTY_SLOT: AppointmentTypeSlot = {
  id: 11,
  name: 'On-call nurse',
  required_count: 2,
  calendars: [],
  pools: [],
};

const PAGE_LIMIT = { limit: 200 };

let nextRowId = 1;

function makeWindow(
  calendarId: number,
  slotId: number
): AppointmentTypeScopedAvailabilityWindow {
  return {
    id: nextRowId++,
    calendar_id: calendarId,
    appointment_type_slot_id: slotId,
    start_time: '2024-01-08T09:00:00Z',
    end_time: '2024-01-08T17:00:00Z',
    timezone: 'UTC',
    rrule_string: 'FREQ=WEEKLY;BYDAY=MO',
    is_recurring: true,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  };
}

function makeBlock(
  calendarId: number,
  slotId: number
): AppointmentTypeScopedBlockedTime {
  return {
    id: nextRowId++,
    calendar_id: calendarId,
    appointment_type_slot_id: slotId,
    start_time: '2024-02-01T00:00:00Z',
    end_time: '2024-02-08T00:00:00Z',
    timezone: 'UTC',
    reason: 'Conference',
    rrule_string: null,
    is_recurring: false,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  };
}

function makeQuotaRule(
  calendarId: number,
  slotId: number
): AppointmentTypeScopedQuotaRule {
  return {
    id: nextRowId++,
    calendar_id: calendarId,
    appointment_type_slot_id: slotId,
    period: 'week',
    cap: 3,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  };
}

/**
 * Seeds a fresh QueryClient's cache with the exact query keys
 * useAppointmentTypeScopedConfigSummary reads, so the story renders its data
 * immediately instead of attempting (and failing) a real network call.
 */
function makeSeededQueryClient({
  slotId,
  windowCalendarIds,
  blockCalendarIds,
  quotaCalendarIds,
}: {
  slotId: number;
  windowCalendarIds: number[];
  blockCalendarIds: number[];
  quotaCalendarIds: number[];
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const path = { appointment_type_id: APPOINTMENT_TYPE_ID, slot_id: slotId };
  const windows = windowCalendarIds.map((id) => makeWindow(id, slotId));
  const blocks = blockCalendarIds.map((id) => makeBlock(id, slotId));
  const quotaRules = quotaCalendarIds.map((id) => makeQuotaRule(id, slotId));

  client.setQueryData(
    appointmentTypesSlotsAvailabilityWindowsListOptions({
      path,
      query: PAGE_LIMIT,
    }).queryKey,
    { count: windows.length, results: windows }
  );
  client.setQueryData(
    appointmentTypesSlotsBlockedTimesListOptions({ path, query: PAGE_LIMIT })
      .queryKey,
    { count: blocks.length, results: blocks }
  );
  client.setQueryData(
    appointmentTypesSlotsQuotaRulesListOptions({ path, query: PAGE_LIMIT })
      .queryKey,
    { count: quotaRules.length, results: quotaRules }
  );

  return client;
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/AppointmentTypes/SlotRoster',
  component: SlotRoster,
  tags: ['autodocs'],
} satisfies Meta<typeof SlotRoster>;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Populated: Story = {
  render: () => {
    const client = makeSeededQueryClient({
      slotId: SLOT.id,
      windowCalendarIds: [100, 100, 101],
      blockCalendarIds: [100],
      quotaCalendarIds: [],
    });
    return (
      <QueryClientProvider client={client}>
        <AppointmentTypePermissionsProvider
          permissions={['organizations.manage_members']}
          ownedCalendarIds={new Set()}
        >
          <SlotRoster appointmentTypeId={APPOINTMENT_TYPE_ID} slot={SLOT} />
        </AppointmentTypePermissionsProvider>
      </QueryClientProvider>
    );
  },
};

export const NoConfiguration: Story = {
  render: () => {
    const client = makeSeededQueryClient({
      slotId: SLOT.id,
      windowCalendarIds: [],
      blockCalendarIds: [],
      quotaCalendarIds: [],
    });
    return (
      <QueryClientProvider client={client}>
        <AppointmentTypePermissionsProvider
          permissions={['organizations.manage_members']}
          ownedCalendarIds={new Set()}
        >
          <SlotRoster appointmentTypeId={APPOINTMENT_TYPE_ID} slot={SLOT} />
        </AppointmentTypePermissionsProvider>
      </QueryClientProvider>
    );
  },
};

// Member who owns one of the slot's two calendars: shows the editable and
// read-only row states side by side, the pair this permission boundary
// exists to distinguish (Phase 2).
export const MemberPartialOwnership: Story = {
  render: () => {
    const client = makeSeededQueryClient({
      slotId: SLOT.id,
      windowCalendarIds: [100],
      blockCalendarIds: [],
      quotaCalendarIds: [],
    });
    return (
      <QueryClientProvider client={client}>
        <AppointmentTypePermissionsProvider
          permissions={[]}
          ownedCalendarIds={new Set([100])}
        >
          <SlotRoster appointmentTypeId={APPOINTMENT_TYPE_ID} slot={SLOT} />
        </AppointmentTypePermissionsProvider>
      </QueryClientProvider>
    );
  },
};

export const EmptyRoster: Story = {
  render: () => {
    const client = makeSeededQueryClient({
      slotId: EMPTY_SLOT.id,
      windowCalendarIds: [],
      blockCalendarIds: [],
      quotaCalendarIds: [],
    });
    return (
      <QueryClientProvider client={client}>
        <SlotRoster appointmentTypeId={APPOINTMENT_TYPE_ID} slot={EMPTY_SLOT} />
      </QueryClientProvider>
    );
  },
};

export const Mobile: Story = {
  ...Populated,
  globals: { viewport: { value: 'mobile' } },
};
