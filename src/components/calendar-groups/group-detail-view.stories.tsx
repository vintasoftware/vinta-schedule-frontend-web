import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CalendarGroup } from '@/client';
import { GroupDetailView } from './group-detail-view';
import { GroupPermissionsProvider } from './group-permissions-provider';

const GROUP: CalendarGroup = {
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

const EMPTY_SLOTS_GROUP: CalendarGroup = {
  ...GROUP,
  id: 2,
  name: 'New Group',
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
  title: 'Components/CalendarGroups/GroupDetailView',
  component: GroupDetailView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof GroupDetailView>;

export default meta;
type Story = StoryObj;

export const Populated: Story = {
  render: () => (
    <QueryClientProvider client={makeQueryClient()}>
      <div className='p-6'>
        <GroupDetailView group={GROUP} />
      </div>
    </QueryClientProvider>
  ),
};

// The context default (no provider in the tree) is `permissions: null`,
// which fails closed — Populated above is therefore the denied state for the
// "Get scheduling link" header action. This story supplies a resolved,
// non-admin permission set that owns one of the group's roster calendars
// (id 100, from GROUP.slots[0].calendars) so the action actually renders.
export const MintLinkAvailable: Story = {
  render: () => (
    <QueryClientProvider client={makeQueryClient()}>
      <GroupPermissionsProvider
        permissions={[]}
        ownedCalendarIds={new Set([100])}
      >
        <div className='p-6'>
          <GroupDetailView group={GROUP} />
        </div>
      </GroupPermissionsProvider>
    </QueryClientProvider>
  ),
};

export const NoSlots: Story = {
  render: () => (
    <QueryClientProvider client={makeQueryClient()}>
      <div className='p-6'>
        <GroupDetailView group={EMPTY_SLOTS_GROUP} />
      </div>
    </QueryClientProvider>
  ),
};

export const Mobile: Story = {
  ...Populated,
  globals: { viewport: { value: 'mobile' } },
};
