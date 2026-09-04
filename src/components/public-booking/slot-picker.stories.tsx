import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import type { BookableSlotProposal } from '@/client';
import { SlotPicker } from './slot-picker';

const PROPOSALS: BookableSlotProposal[] = [
  {
    start_time: '2026-03-02T15:00:00.000Z',
    end_time: '2026-03-02T15:30:00.000Z',
  },
  {
    start_time: '2026-03-02T16:00:00.000Z',
    end_time: '2026-03-02T16:30:00.000Z',
  },
  // A pinned-duration proposal spanning 45 min — proves the picker renders
  // each proposal's OWN length rather than a single assumed duration.
  {
    start_time: '2026-03-03T18:00:00.000Z',
    end_time: '2026-03-03T18:45:00.000Z',
  },
];

const meta = {
  title: 'Components/PublicBooking/SlotPicker',
  component: SlotPicker,
  tags: ['autodocs'],
  args: {
    proposals: PROPOSALS,
    timezone: 'UTC',
    selectedSlot: null,
    onSelect: fn(),
    isLoading: false,
  },
} satisfies Meta<typeof SlotPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithASelection: Story = {
  args: { selectedSlot: PROPOSALS[0] },
};

export const Loading: Story = {
  args: { isLoading: true },
};

export const Empty: Story = {
  args: { proposals: [] },
};
