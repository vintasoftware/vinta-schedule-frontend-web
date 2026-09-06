import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { appointmentTypesSlotsAvailabilityWindowsListOptions } from '@/client/@tanstack/react-query.gen';
import { appointmentTypeAvailabilityPreviewQueryKey } from '@/hooks/appointment-types/use-appointment-type-availability-preview';
import { APPOINTMENT_TYPE_SCOPED_WINDOWS_PAGE_SIZE } from '@/hooks/appointment-types/use-appointment-type-scoped-windows';
import type {
  AppointmentTypeRangeAvailability,
  AppointmentTypeScopedAvailabilityWindow,
} from '@/client';
import { AppointmentTypeAvailabilityPreview } from './appointment-type-availability-preview';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
//
// These fixtures deliberately match what the REAL backend can produce: an
// `available_calendar_ids` hit for a probed range only occurs when a single
// `AvailableTime` span fully covers that exact range (see
// `use-appointment-type-availability-preview.ts`'s module doc comment). There is no
// full-day probe here and no fixture claiming a 24-hour range is
// "available" for a calendar that isn't actually configured 24/7 — that
// response cannot occur in production.

const APPOINTMENT_TYPE_ID = 1;
const SLOT_ID = 10;
const CALENDAR_ID = 100;
const TIMEZONE = 'UTC';
const START_DATE = '2026-08-10'; // Monday
const END_DATE = '2026-08-16'; // Sunday

let nextWindowId = 1;

function makeWeeklyWindow(
  overrides: Partial<AppointmentTypeScopedAvailabilityWindow> = {}
): AppointmentTypeScopedAvailabilityWindow {
  return {
    id: nextWindowId++,
    calendar_id: CALENDAR_ID,
    appointment_type_slot_id: SLOT_ID,
    start_time: '2024-01-02T09:00:00Z', // Tuesday
    end_time: '2024-01-02T17:00:00Z',
    timezone: TIMEZONE,
    rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
    is_recurring: true,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function rangeAvailability(
  startTime: string,
  endTime: string,
  available: boolean
): AppointmentTypeRangeAvailability {
  return {
    start_time: startTime,
    end_time: endTime,
    slots: [
      {
        slot_id: SLOT_ID,
        available_calendar_ids: available ? [CALENDAR_ID] : [],
        required_count: 1,
        is_bookable: available,
      },
    ],
  };
}

function makeSeededQueryClient(
  windows: AppointmentTypeScopedAvailabilityWindow[],
  availabilityResults: AppointmentTypeRangeAvailability[]
): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(
    appointmentTypesSlotsAvailabilityWindowsListOptions({
      path: { appointment_type_id: APPOINTMENT_TYPE_ID, slot_id: SLOT_ID },
      query: { limit: APPOINTMENT_TYPE_SCOPED_WINDOWS_PAGE_SIZE },
    }).queryKey,
    { count: windows.length, results: windows }
  );
  client.setQueryData(
    appointmentTypeAvailabilityPreviewQueryKey({
      appointmentTypeId: APPOINTMENT_TYPE_ID,
      slotId: SLOT_ID,
      calendarId: CALENDAR_ID,
      startDate: START_DATE,
      endDate: END_DATE,
      timezone: TIMEZONE,
    }),
    availabilityResults
  );
  return client;
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/AppointmentTypes/AppointmentTypeAvailabilityPreview',
  component: AppointmentTypeAvailabilityPreview,
  tags: ['autodocs'],
  args: {
    appointmentTypeId: APPOINTMENT_TYPE_ID,
    slotId: SLOT_ID,
    calendarId: CALENDAR_ID,
    calendarName: 'Dr. Reyes',
    initialStartDate: START_DATE,
    initialEndDate: END_DATE,
    initialTimezone: TIMEZONE,
  },
} satisfies Meta<typeof AppointmentTypeAvailabilityPreview>;

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
      <AppointmentTypeAvailabilityPreview {...args} />
    </QueryClientProvider>
  ),
};

// A calendar configured Tuesdays and Thursdays over the coming week (spec
// UC-7's acceptance scenario), where Tuesday actually comes back bookable
// but Thursday's declared window isn't covered by base availability --
// exactly the intersect-only narrowing UC-7 exists to surface. The other
// five days have no appointment-type-scoped window at all in this slot, so they render
// as "No config" rather than "Not free".
export const MixedRange: Story = {
  args: { initialOpen: true },
  render: (args) => {
    const windows = [
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
    ];
    const results = [
      rangeAvailability(
        '2026-08-11T09:00:00.000Z',
        '2026-08-11T17:00:00.000Z',
        true
      ), // Tuesday -- bookable
      rangeAvailability(
        '2026-08-13T09:00:00.000Z',
        '2026-08-13T17:00:00.000Z',
        false
      ), // Thursday -- declared but not actually free
    ];
    return (
      <QueryClientProvider client={makeSeededQueryClient(windows, results)}>
        <AppointmentTypeAvailabilityPreview {...args} />
      </QueryClientProvider>
    );
  },
};

// A Saturday window on a calendar whose base availability excludes Saturday
// (spec UC-7's motivating scenario): the one configured day is probed and
// comes back not free, and it's the only configured day in range, so the
// strip renders the explicit "not available" answer, not an error.
export const EmptyRange: Story = {
  args: { initialOpen: true },
  render: (args) => {
    const windows = [
      makeWeeklyWindow({
        start_time: '2024-01-06T09:00:00Z', // Saturday
        end_time: '2024-01-06T17:00:00Z',
        rrule_string: 'FREQ=WEEKLY;BYDAY=SA',
      }),
    ];
    const results = [
      rangeAvailability(
        '2026-08-15T09:00:00.000Z',
        '2026-08-15T17:00:00.000Z',
        false
      ), // Saturday -- declared, but base hours don't cover it
    ];
    return (
      <QueryClientProvider client={makeSeededQueryClient(windows, results)}>
        <AppointmentTypeAvailabilityPreview {...args} />
      </QueryClientProvider>
    );
  },
};

// A calendar with NO appointment-type-scoped window at all for this slot -- there is
// nothing to probe, so the strip says so explicitly rather than running a
// doomed full-day check (BLOCKER fix). Distinct from EmptyRange above,
// where a window IS configured but doesn't help.
export const NoConfiguration: Story = {
  args: { initialOpen: true },
  render: (args) => (
    <QueryClientProvider client={makeSeededQueryClient([], [])}>
      <AppointmentTypeAvailabilityPreview {...args} />
    </QueryClientProvider>
  ),
};

// An inverted picked range ("To" before "From") -- distinct from a
// genuinely-queried range that came back with zero free days (SHOULD-FIX).
export const InvalidRange: Story = {
  args: {
    initialOpen: true,
    initialStartDate: END_DATE,
    initialEndDate: START_DATE,
  },
  render: (args) => (
    <QueryClientProvider client={new QueryClient()}>
      <AppointmentTypeAvailabilityPreview {...args} />
    </QueryClientProvider>
  ),
};

export const Mobile: Story = {
  ...MixedRange,
  globals: { viewport: { value: 'mobile' } },
};
