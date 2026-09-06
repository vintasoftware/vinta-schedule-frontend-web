import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AppointmentTypeScopedBlockedTime } from '@/client';
import { AppointmentTypeBlockForm } from './appointment-type-block-form';

// AppointmentTypeBlockForm calls useAppointmentTypeScopedBlocks with `enabled: false` (it only
// needs the mutation functions, not the list read -- see the module doc
// comment), so no query needs to be seeded here; the QueryClientProvider is
// present only because the hook requires one in the tree.
function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const EXISTING_BLOCK: AppointmentTypeScopedBlockedTime = {
  id: 501,
  calendar_id: 100,
  appointment_type_slot_id: 10,
  start_time: '2026-09-08T09:00:00-03:00',
  end_time: '2026-09-08T17:00:00-03:00',
  timezone: 'America/Sao_Paulo',
  reason: 'Conference',
  rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
  is_recurring: true,
  created: '2026-01-01T00:00:00Z',
  modified: '2026-01-01T00:00:00Z',
};

const meta = {
  title: 'Components/AppointmentTypes/AppointmentTypeBlockForm',
  component: AppointmentTypeBlockForm,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <div className='w-full max-w-lg'>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof AppointmentTypeBlockForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  args: {
    appointmentTypeId: 1,
    slotId: 10,
    calendarId: 100,
  },
};

// Editing an existing RECURRING block hydrates `repeat: true` straight from
// `block.rrule_string` (see `blockToFormValues`), which is what renders the
// repeat sub-form open by default -- no interaction needed to reach it. This
// repo has no `play` functions because the interactions addon isn't installed
// (see .storybook/main.ts); interaction coverage lives in vitest tests instead.
export const EditWithRepeatOpen: Story = {
  args: {
    appointmentTypeId: 1,
    slotId: 10,
    calendarId: 100,
    block: EXISTING_BLOCK,
  },
};
