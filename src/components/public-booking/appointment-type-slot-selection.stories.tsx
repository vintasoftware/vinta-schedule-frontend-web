import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import type { SlotViewModel } from '@/lib/booking-links/appointment-type-selection';
import { AppointmentTypeSlotSelection } from './appointment-type-slot-selection';

const SATISFIABLE_SLOTS: SlotViewModel[] = [
  {
    slotId: 1,
    name: 'Slot 1',
    requiredCount: 1,
    pool: [{ id: 10, name: 'Option 1' }],
    availableCalendarIds: [10],
  },
  {
    slotId: 2,
    name: 'Slot 2',
    requiredCount: 1,
    pool: [
      { id: 20, name: 'Option 1' },
      { id: 21, name: 'Option 2' },
    ],
    // Option 2 (id 21) is in the pool but not free — renders disabled.
    availableCalendarIds: [20],
  },
];

const WITH_SELECTION: Record<number, number[]> = { 1: [10], 2: [20] };

// One slot needs 2 candidates but only 1 is free — hard-blocks submit.
const UNSATISFIABLE_SLOTS: SlotViewModel[] = [
  SATISFIABLE_SLOTS[0],
  {
    slotId: 3,
    name: 'Slot 3',
    requiredCount: 2,
    pool: [{ id: 30, name: 'Option 1' }],
    availableCalendarIds: [30],
  },
];

const meta = {
  title: 'Components/PublicBooking/AppointmentTypeSlotSelection',
  component: AppointmentTypeSlotSelection,
  tags: ['autodocs'],
  args: {
    slots: SATISFIABLE_SLOTS,
    selection: {},
    onToggle: fn(),
    onSubmit: fn(),
    isSubmitting: false,
  },
} satisfies Meta<typeof AppointmentTypeSlotSelection>;

export default meta;
type Story = StoryObj<typeof meta>;

// `Default` (via `meta.args`) already uses `SATISFIABLE_SLOTS`, which bakes
// in a busy candidate (id 21, in Slot 2's pool but absent from
// `availableCalendarIds`) — a separate `WithABusyCandidate` story using the
// same fixture would render identically, so that state is covered by
// `Default` alone.

export const CompleteSelection: Story = {
  args: { selection: WITH_SELECTION },
};

export const Unsatisfiable: Story = {
  args: { slots: UNSATISFIABLE_SLOTS, selection: { 1: [10] } },
};

export const Submitting: Story = {
  args: { selection: WITH_SELECTION, isSubmitting: true },
};
