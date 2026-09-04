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
  // A pinned-duration proposal spanning 45 min, on a DIFFERENT day — proves
  // both that the picker renders each proposal's OWN length rather than a
  // single assumed duration, and that only days with a proposal are
  // selectable in the calendar.
  {
    start_time: '2026-03-05T18:00:00.000Z',
    end_time: '2026-03-05T18:45:00.000Z',
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

// A non-UTC zone exercises the exact conversion `proposalDayKey` introduces:
// times that read as one UTC calendar day group under a DIFFERENT day once
// converted to `timezone`, so the day grid and the per-day time list must
// agree on the SAME (converted) day, not the raw UTC date.
const MULTI_DAY_MULTI_PROPOSAL_PROPOSALS: BookableSlotProposal[] = [
  // 23:00 UTC on the 2nd is 15:00 on the 3rd in Asia/Tokyo (UTC+9) — day A.
  {
    start_time: '2026-03-02T23:00:00.000Z',
    end_time: '2026-03-02T23:30:00.000Z',
  },
  {
    start_time: '2026-03-03T00:00:00.000Z',
    end_time: '2026-03-03T00:30:00.000Z',
  },
  // A different UTC day that lands on a different Tokyo day too — day B.
  {
    start_time: '2026-03-05T09:00:00.000Z',
    end_time: '2026-03-05T09:45:00.000Z',
  },
];

export const MultiDayMultiProposal: Story = {
  args: {
    proposals: MULTI_DAY_MULTI_PROPOSAL_PROPOSALS,
    timezone: 'Asia/Tokyo',
  },
};
