import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AppointmentType } from '@/client';
import { AppointmentTypeDetailView } from './appointment-type-detail-view';
import { AppointmentTypePermissionsProvider } from './appointment-type-permissions-provider';
import { PermissionProvider } from '@/components/navigation/permission-gate';
import { STORY_POOLS } from '@/components/calendar-pools/fixtures';

const ADMIN_PERMISSIONS = ['organizations.manage_members'];

const APPOINTMENT_TYPE: AppointmentType = {
  id: 1,
  name: 'Surgery Team',
  description: 'Operating room coverage for scheduled procedures.',
  slots: [
    {
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
          name: 'Dr. Lee',
          email: 'lee@example.com',
          external_id: 'ext-101',
          provider: 'google',
          calendar_type: 'personal',
        },
      ],
      pools: [],
    },
    {
      id: 11,
      name: 'Operating room',
      description: 'A room resource, not a person.',
      required_count: 1,
      calendars: [
        {
          id: 102,
          name: 'OR 1',
          email: 'or1@example.com',
          external_id: 'ext-102',
          provider: 'google',
          calendar_type: 'resource',
        },
      ],
      pools: [],
    },
  ],
  public_booking_slug: 'surgery-team',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

/**
 * The same appointment type with each slot fed by a pool — the slot header then names the
 * pools behind its roster.
 */
const POOLED_APPOINTMENT_TYPE: AppointmentType = {
  ...APPOINTMENT_TYPE,
  id: 3,
  slots: [
    { ...APPOINTMENT_TYPE.slots[0], pools: [STORY_POOLS[0]] },
    { ...APPOINTMENT_TYPE.slots[1], pools: [STORY_POOLS[1]] },
  ],
};

const EMPTY_SLOTS_APPOINTMENT_TYPE: AppointmentType = {
  ...APPOINTMENT_TYPE,
  id: 2,
  name: 'New Appointment Type',
  description: undefined,
  slots: [],
};

// A fresh, unseeded QueryClient — SlotRoster's summary queries fail fast
// (retry:false) and render "Unable to load configuration counts" rather than
// hanging, which is an acceptable look for a story that's about the page
// header and slot layout, not the summary cell's data states (see
// slot-roster.stories.tsx for those).
function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const meta = {
  title: 'Components/AppointmentTypes/AppointmentTypeDetailView',
  component: AppointmentTypeDetailView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppointmentTypeDetailView>;

export default meta;
type Story = StoryObj;

export const Populated: Story = {
  render: () => (
    <QueryClientProvider client={makeQueryClient()}>
      <div className='p-6'>
        <AppointmentTypeDetailView appointmentType={APPOINTMENT_TYPE} />
      </div>
    </QueryClientProvider>
  ),
};

// The context default (no provider in the tree) is `permissions: null`,
// which fails closed — Populated above is therefore the denied state for the
// "Get scheduling link" header action. This story supplies a resolved,
// non-admin permission set that owns one of the appointment type's roster calendars
// (id 100, from APPOINTMENT_TYPE.slots[0].calendars) so the action actually renders.
export const MintLinkAvailable: Story = {
  render: () => (
    <QueryClientProvider client={makeQueryClient()}>
      <AppointmentTypePermissionsProvider
        permissions={[]}
        ownedCalendarIds={new Set([100])}
      >
        <div className='p-6'>
          <AppointmentTypeDetailView appointmentType={APPOINTMENT_TYPE} />
        </div>
      </AppointmentTypePermissionsProvider>
    </QueryClientProvider>
  ),
};

/** An org admin: the header carries the "Edit appointment type" action. */
export const AsAdmin: Story = {
  render: () => (
    <QueryClientProvider client={makeQueryClient()}>
      <PermissionProvider permissions={ADMIN_PERMISSIONS}>
        <div className='p-6'>
          <AppointmentTypeDetailView appointmentType={APPOINTMENT_TYPE} />
        </div>
      </PermissionProvider>
    </QueryClientProvider>
  ),
};

/** Slots fed by calendar pools — each slot names the pools behind its roster. */
export const WithPools: Story = {
  render: () => (
    <QueryClientProvider client={makeQueryClient()}>
      <PermissionProvider permissions={ADMIN_PERMISSIONS}>
        <div className='p-6'>
          <AppointmentTypeDetailView
            appointmentType={POOLED_APPOINTMENT_TYPE}
          />
        </div>
      </PermissionProvider>
    </QueryClientProvider>
  ),
};

export const NoSlots: Story = {
  render: () => (
    <QueryClientProvider client={makeQueryClient()}>
      <div className='p-6'>
        <AppointmentTypeDetailView
          appointmentType={EMPTY_SLOTS_APPOINTMENT_TYPE}
        />
      </div>
    </QueryClientProvider>
  ),
};

export const Mobile: Story = {
  ...Populated,
  globals: { viewport: { value: 'mobile' } },
};
