import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CalendarGroup } from '@/client';
import { PermissionProvider } from '@/components/navigation/permission-gate';
import { PublicSchedulingSettings } from './public-scheduling-settings';

function makeGroup(overrides: Partial<CalendarGroup> = {}): CalendarGroup {
  return {
    id: 1,
    name: 'Surgery Team',
    description: 'Operating room coverage',
    slots: [],
    public_booking_slug: 'surgery-team',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Seeded({
  group,
  role,
}: {
  group: CalendarGroup;
  role: 'admin' | 'member';
}) {
  const permissions = role === 'admin' ? ['organizations.manage_members'] : [];
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <PermissionProvider permissions={permissions}>
        <div className='max-w-xl p-6'>
          <PublicSchedulingSettings group={group} />
        </div>
      </PermissionProvider>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Components/CalendarGroups/PublicSchedulingSettings',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Admin, public scheduling off — the neutral starting state. */
export const Off: Story = {
  render: () => (
    <Seeded
      role='admin'
      group={makeGroup({
        accepts_public_scheduling: false,
        duration: undefined,
      })}
    />
  ),
};

/** Admin, public scheduling on with a real appointment length set. */
export const OnWithDuration: Story = {
  render: () => (
    <Seeded
      role='admin'
      group={makeGroup({
        accepts_public_scheduling: true,
        duration: '00:30:00',
      })}
    />
  ),
};

/**
 * A group flipped public before this duration constraint existed (or before
 * `accepts_public_scheduling` shipped at all) — grandfathered at rest by the
 * backend, refused at booking time. Rendered as a warning, not as a healthy
 * "public" toggle.
 */
export const GrandfatheredNullDuration: Story = {
  render: () => (
    <Seeded
      role='admin'
      group={makeGroup({
        accepts_public_scheduling: true,
        duration: undefined,
      })}
    />
  ),
};

/**
 * A non-admin member viewing the same public, duration-set group as
 * `OnWithDuration` — every control renders disabled and there is no save
 * action, so nothing on screen implies a partial save is possible.
 */
export const MemberReadOnly: Story = {
  render: () => (
    <Seeded
      role='member'
      group={makeGroup({
        accepts_public_scheduling: true,
        duration: '00:30:00',
      })}
    />
  ),
};
