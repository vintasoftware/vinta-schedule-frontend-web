import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn, mocked } from 'storybook/test';
import type { BookableSlotProposal } from '@/client';
import { CodelessGroupReadFailureError } from '@/lib/booking-links/codeless-group-read-errors';
// Mocked in .storybook/preview.tsx via `sb.mock(...)`; `mocked()` just types
// it — see `public-group-booking-flow.stories.tsx` for the identical
// rationale.
import { useCodelessGroupBookableSlots } from '@/hooks/booking-codes/use-codeless-group-booking';
import { CodelessGroupBookingFlow } from './codeless-group-booking-flow';

// This story covers the flow's whole-group proposal READ states, including
// the two states unique to this phase — `not-found` vs `unavailable`. The
// per-slot selection, confirmed, and terminal-write-error states depend on
// driving a multi-step interaction against a real network call, and are
// covered instead by the colocated `codeless-group-booking-flow.test.tsx`.

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
  title: 'Components/PublicBooking/CodelessGroupBookingFlow',
  component: CodelessGroupBookingFlow,
  tags: ['autodocs'],
  args: {
    publicSlug: 'surgery-team',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof CodelessGroupBookingFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Whole-group time proposals loaded — the picker's normal state. */
export const BookableProposals: Story = {
  decorators: [
    (Story) => {
      mocked(useCodelessGroupBookableSlots).mockReturnValue({
        data: PROPOSALS,
        isLoading: false,
        isError: false,
        error: null,
        refetch: fn(),
      } as unknown as ReturnType<typeof useCodelessGroupBookableSlots>);
      return <Story />;
    },
  ],
};

export const Loading: Story = {
  decorators: [
    (Story) => {
      mocked(useCodelessGroupBookableSlots).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: fn(),
      } as unknown as ReturnType<typeof useCodelessGroupBookableSlots>);
      return <Story />;
    },
  ],
};

/**
 * An unknown `public_booking_slug` — a real `404`. Distinct from
 * `NotPublic` below; see `@/lib/booking-links/codeless-group-read-errors`.
 */
export const UnknownSlug: Story = {
  decorators: [
    (Story) => {
      mocked(useCodelessGroupBookableSlots).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new CodelessGroupReadFailureError('not-found'),
        refetch: fn(),
      } as unknown as ReturnType<typeof useCodelessGroupBookableSlots>);
      return <Story />;
    },
  ],
};

/**
 * A real group that exists but isn't bookable here — private, or public
 * with no usable duration. A real `403`, distinct from `UnknownSlug` above.
 */
export const NotPublic: Story = {
  decorators: [
    (Story) => {
      mocked(useCodelessGroupBookableSlots).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new CodelessGroupReadFailureError('unavailable'),
        refetch: fn(),
      } as unknown as ReturnType<typeof useCodelessGroupBookableSlots>);
      return <Story />;
    },
  ],
};

/**
 * A non-404/403 read failure (network error, 5xx) — renders a generic
 * retryable error rather than either dedicated state above.
 */
export const ProposalsLoadError: Story = {
  decorators: [
    (Story) => {
      mocked(useCodelessGroupBookableSlots).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new CodelessGroupReadFailureError('error'),
        refetch: fn(),
      } as unknown as ReturnType<typeof useCodelessGroupBookableSlots>);
      return <Story />;
    },
  ],
};
