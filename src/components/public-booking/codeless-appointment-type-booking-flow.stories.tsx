import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn, mocked } from 'storybook/test';
import type { BookableSlotProposal } from '@/client';
import { CodelessAppointmentTypeReadFailureError } from '@/lib/booking-links/codeless-appointment-type-read-errors';
// Mocked in .storybook/preview.tsx via `sb.mock(...)`; `mocked()` just types
// it — see `public-appointment-type-booking-flow.stories.tsx` for the identical
// rationale.
import { useCodelessAppointmentTypeBookableSlots } from '@/hooks/booking-codes/use-codeless-appointment-type-booking';
import { CodelessAppointmentTypeBookingFlow } from './codeless-appointment-type-booking-flow';

// This story covers the flow's whole-appointment-type proposal READ states, including
// the two states unique to this phase — `not-found` vs `unavailable`. The
// per-slot selection, confirmed, and terminal-write-error states depend on
// driving a multi-step interaction against a real network call, and are
// covered instead by the colocated `codeless-appointment-type-booking-flow.test.tsx`.

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
  title: 'Components/PublicBooking/CodelessAppointmentTypeBookingFlow',
  component: CodelessAppointmentTypeBookingFlow,
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
} satisfies Meta<typeof CodelessAppointmentTypeBookingFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Whole-appointment type time proposals loaded — the picker's normal state. */
export const BookableProposals: Story = {
  decorators: [
    (Story) => {
      mocked(useCodelessAppointmentTypeBookableSlots).mockReturnValue({
        data: PROPOSALS,
        isLoading: false,
        isError: false,
        error: null,
        refetch: fn(),
      } as unknown as ReturnType<
        typeof useCodelessAppointmentTypeBookableSlots
      >);
      return <Story />;
    },
  ],
};

export const Loading: Story = {
  decorators: [
    (Story) => {
      mocked(useCodelessAppointmentTypeBookableSlots).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: fn(),
      } as unknown as ReturnType<
        typeof useCodelessAppointmentTypeBookableSlots
      >);
      return <Story />;
    },
  ],
};

/**
 * An unknown `public_booking_slug` — a real `404`. Distinct from
 * `NotPublic` below; see `@/lib/booking-links/codeless-appointment-type-read-errors`.
 */
export const UnknownSlug: Story = {
  decorators: [
    (Story) => {
      mocked(useCodelessAppointmentTypeBookableSlots).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new CodelessAppointmentTypeReadFailureError('not-found'),
        refetch: fn(),
      } as unknown as ReturnType<
        typeof useCodelessAppointmentTypeBookableSlots
      >);
      return <Story />;
    },
  ],
};

/**
 * A real appointment type that exists but isn't bookable here — private, or public
 * with no usable duration. A real `403`, distinct from `UnknownSlug` above.
 */
export const NotPublic: Story = {
  decorators: [
    (Story) => {
      mocked(useCodelessAppointmentTypeBookableSlots).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new CodelessAppointmentTypeReadFailureError('unavailable'),
        refetch: fn(),
      } as unknown as ReturnType<
        typeof useCodelessAppointmentTypeBookableSlots
      >);
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
      mocked(useCodelessAppointmentTypeBookableSlots).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new CodelessAppointmentTypeReadFailureError('error'),
        refetch: fn(),
      } as unknown as ReturnType<
        typeof useCodelessAppointmentTypeBookableSlots
      >);
      return <Story />;
    },
  ],
};
