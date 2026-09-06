import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mocked } from 'storybook/test';
import type { AppointmentType } from '@/client';
import { PermissionProvider } from '@/components/navigation/permission-gate';
// Mocked in .storybook/preview.tsx via `sb.mock(...)`; `mocked()` just types
// it — a real `/organizations/current` fetch would fail in Storybook, so
// this gives the Phase 7 reusable-link section a deterministic branded slug
// instead of falling back to the bare `/g/...` URL on every story.
import { useCurrentOrganization } from '@/hooks/organizations/use-current-organization';
import { PublicSchedulingSettings } from './public-scheduling-settings';

function makeAppointmentType(
  overrides: Partial<AppointmentType> = {}
): AppointmentType {
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
  appointmentType,
  role,
}: {
  appointmentType: AppointmentType;
  role: 'admin' | 'member';
}) {
  const permissions = role === 'admin' ? ['organizations.manage_members'] : [];
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <PermissionProvider permissions={permissions}>
        <div className='max-w-xl p-6'>
          <PublicSchedulingSettings appointmentType={appointmentType} />
        </div>
      </PermissionProvider>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Components/AppointmentTypes/PublicSchedulingSettings',
  tags: ['autodocs'],
  decorators: [
    (Story) => {
      mocked(useCurrentOrganization).mockReturnValue({
        organization: { slug: 'acme' },
        isOnboarded: true,
        isGated: false,
        isDisabled: false,
        membership: null,
        permissions: [],
        isLoading: false,
        isError: false,
        error: null,
        query: {} as unknown as never,
      } as unknown as ReturnType<typeof useCurrentOrganization>);
      return <Story />;
    },
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Admin, public scheduling off — the neutral starting state. */
export const Off: Story = {
  render: () => (
    <Seeded
      role='admin'
      appointmentType={makeAppointmentType({
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
      appointmentType={makeAppointmentType({
        accepts_public_scheduling: true,
        duration: '00:30:00',
      })}
    />
  ),
};

/**
 * An appointment type flipped public before this duration constraint existed (or before
 * `accepts_public_scheduling` shipped at all) — grandfathered at rest by the
 * backend, refused at booking time. Rendered as a warning, not as a healthy
 * "public" toggle.
 */
export const GrandfatheredNullDuration: Story = {
  render: () => (
    <Seeded
      role='admin'
      appointmentType={makeAppointmentType({
        accepts_public_scheduling: true,
        duration: undefined,
      })}
    />
  ),
};

/**
 * A non-admin member viewing the same public, duration-set appointment type as
 * `OnWithDuration` — every control renders disabled and there is no save
 * action, so nothing on screen implies a partial save is possible.
 */
export const MemberReadOnly: Story = {
  render: () => (
    <Seeded
      role='member'
      appointmentType={makeAppointmentType({
        accepts_public_scheduling: true,
        duration: '00:30:00',
      })}
    />
  ),
};
