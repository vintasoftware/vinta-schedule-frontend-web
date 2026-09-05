import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn, mocked } from 'storybook/test';
import type { BookableSlotProposal } from '@/client';
import { PublicReadFailureError } from '@/lib/booking-links/errors';
// Mocked in .storybook/preview.tsx via `sb.mock(...)`; `mocked()` just types
// it — see `public-booking-flow.stories.tsx` for the identical rationale.
import { usePublicGroupBookableSlots } from '@/hooks/booking-codes/use-public-group-booking';
import { PublicGroupBookingFlow } from './public-group-booking-flow';

// This story covers the flow's whole-group proposal READ states, the same
// split as `public-booking-flow.stories.tsx`: the per-slot selection,
// confirmed, and terminal-write-error states depend on driving a multi-step
// interaction against a real network call, and are covered instead by the
// colocated `public-group-booking-flow.test.tsx`.

const PROPOSALS: BookableSlotProposal[] = [
  {
    start_time: '2026-03-02T15:00:00.000Z',
    end_time: '2026-03-02T15:30:00.000Z',
  },
  {
    start_time: '2026-03-02T16:00:00.000Z',
    end_time: '2026-03-02T16:30:00.000Z',
  },
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

const meta = {
  title: 'Components/PublicBooking/PublicGroupBookingFlow',
  component: PublicGroupBookingFlow,
  tags: ['autodocs'],
  args: {
    code: 'story-demo-code',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof PublicGroupBookingFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Whole-group time proposals loaded — the picker's normal state. */
export const BookableProposals: Story = {
  decorators: [
    (Story) => {
      mocked(usePublicGroupBookableSlots).mockReturnValue({
        data: PROPOSALS,
        isLoading: false,
        isError: false,
        error: null,
        refetch: fn(),
      } as unknown as ReturnType<typeof usePublicGroupBookableSlots>);
      return <Story />;
    },
  ],
};

export const Loading: Story = {
  decorators: [
    (Story) => {
      mocked(usePublicGroupBookableSlots).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: fn(),
      } as unknown as ReturnType<typeof usePublicGroupBookableSlots>);
      return <Story />;
    },
  ],
};

/**
 * Every code failure on the READ path collapses into this one opaque state
 * — same rule as the single-calendar flow. Never differentiate.
 */
export const LinkInvalid: Story = {
  decorators: [
    (Story) => {
      mocked(usePublicGroupBookableSlots).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new PublicReadFailureError('link-invalid'),
        refetch: fn(),
      } as unknown as ReturnType<typeof usePublicGroupBookableSlots>);
      return <Story />;
    },
  ],
};

/**
 * A non-403 read failure (network error, 5xx) — renders a generic retryable
 * error rather than `LinkInvalid`.
 */
export const ProposalsLoadError: Story = {
  decorators: [
    (Story) => {
      mocked(usePublicGroupBookableSlots).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new PublicReadFailureError('error'),
        refetch: fn(),
      } as unknown as ReturnType<typeof usePublicGroupBookableSlots>);
      return <Story />;
    },
  ],
};
