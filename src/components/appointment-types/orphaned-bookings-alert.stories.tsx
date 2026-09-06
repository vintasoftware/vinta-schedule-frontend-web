import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { OrphanedBookingsAlert } from './orphaned-bookings-alert';

// No AppointmentTypePermissionsProvider wrapper -- unlike most appointment-types
// stories, this component reads no permission context (same precedent as
// appointment-type-not-found.stories.tsx, the other permission-agnostic component in
// this feature).
const meta = {
  title: 'Components/AppointmentTypes/OrphanedBookingsAlert',
  component: OrphanedBookingsAlert,
  tags: ['autodocs'],
} satisfies Meta<typeof OrphanedBookingsAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: {
    bookings: [
      {
        id: 1,
        calendar_id: 42,
        title: 'Consult with Dr. Reyes',
        start_time: '2024-06-04T13:00:00Z',
        end_time: '2024-06-04T14:00:00Z',
      },
      {
        id: 2,
        calendar_id: 42,
        title: 'Follow-up visit',
        start_time: '2024-06-06T15:30:00Z',
        end_time: '2024-06-06T16:00:00Z',
      },
    ],
  },
};

// The component renders nothing for an empty list -- callers are expected
// to gate on `bookings.length > 0` (see appointment-type-window-grid.tsx), but the
// empty case is still exercised here so a regression that makes it render
// an empty shell is visible in the catalog.
export const Empty: Story = {
  args: {
    bookings: [],
  },
};

export const Mobile: Story = {
  ...Populated,
  globals: { viewport: { value: 'mobile' } },
};
