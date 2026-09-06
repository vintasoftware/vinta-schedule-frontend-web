import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AppointmentType } from '@/client';
import { EditAppointmentTypeDialog } from './edit-appointment-type-dialog';
import {
  STORY_CALENDARS,
  STORY_POOLS,
  makeStoryFetch,
} from '@/components/calendar-pools/fixtures';

/**
 * A saved appointment type whose "Nurse" slot draws from the Nurses pool plus one
 * individually picked calendar — the case the edit form has to split back
 * apart, since the API reports the roster as one flat list.
 */
const APPOINTMENT_TYPE: AppointmentType = {
  id: 42,
  name: 'Clinic Appointments',
  description: 'Walk-in coverage.',
  public_booking_slug: 'grp-42',
  slots: [
    {
      id: 100,
      name: 'Nurse',
      required_count: 1,
      calendars: [STORY_CALENDARS[0], STORY_CALENDARS[1], STORY_CALENDARS[2]],
      pools: [STORY_POOLS[0]],
    },
    {
      id: 101,
      name: 'Consult room',
      description: 'A room resource, not a person.',
      required_count: 1,
      calendars: [STORY_CALENDARS[3]],
      pools: [STORY_POOLS[1]],
    },
  ],
  created: '2024-01-01T00:00:00Z',
  modified: '2024-06-01T00:00:00Z',
};

const meta = {
  title: 'Components/AppointmentTypes/EditAppointmentTypeDialog',
  component: EditAppointmentTypeDialog,
  parameters: { layout: 'centered' },
  args: {
    open: true,
    onOpenChange: () => {},
    appointmentType: APPOINTMENT_TYPE,
  },
  decorators: [
    (Story) => {
      global.fetch = makeStoryFetch() as typeof global.fetch;
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof EditAppointmentTypeDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No pools attached anywhere — the form the app showed before pools existed. */
export const WithoutPools: Story = {
  args: {
    appointmentType: {
      ...APPOINTMENT_TYPE,
      slots: APPOINTMENT_TYPE.slots.map((slot) => ({ ...slot, pools: [] })),
    },
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile' } },
};
