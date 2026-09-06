import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn, mocked } from 'storybook/test';
// Auto-mocked by `@storybook/nextjs-vite`'s Next.js integration — no
// `sb.mock` registration needed (unlike the data hook below).
import { useSearchParams } from 'next/navigation';
import type { BookableSlotProposal } from '@/client';
import { PublicReadFailureError } from '@/lib/booking-links/errors';
// Mocked in .storybook/preview.tsx via `sb.mock(...)`; `mocked()` just types
// it. `usePublicBookEvent` is left real — it never fires unless a story
// drives a submit, which none of these do (see the note below).
import { usePublicBookableSlots } from '@/hooks/booking-codes/use-public-bookable-slots';
import { PublicBookingFlow } from './public-booking-flow';

/**
 * A stand-in for `next/navigation`'s `ReadonlyURLSearchParams` — every call
 * site in this flow only ever reads `.get()`, and `URLSearchParams` already
 * implements that. Constructed instead of importing the real class: the
 * `@storybook/nextjs-vite` build's pre-bundled `next/navigation` mock does
 * not re-export `ReadonlyURLSearchParams` at runtime (only the hooks it
 * explicitly wraps), so importing it as a VALUE breaks every story in this
 * file with "does not provide an export named 'ReadonlyURLSearchParams'".
 * See the phase notes for the upstream evidence.
 */
function fakeSearchParams(
  init?: ConstructorParameters<typeof URLSearchParams>[0]
): ReturnType<typeof useSearchParams> {
  return new URLSearchParams(init) as unknown as ReturnType<
    typeof useSearchParams
  >;
}

// This story covers the flow's READ states — the ones reachable without
// driving a multi-step interaction (pick a slot → fill the attendee form →
// submit). The confirmed / terminal-write-error states depend on a write
// response and are exercised end to end in the colocated
// `public-booking-flow.test.tsx` instead, following the same split as
// `group-booking-flow.stories.tsx` (stories stop where a real interaction
// would otherwise be needed to drive a network call).

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
  title: 'Components/PublicBooking/PublicBookingFlow',
  component: PublicBookingFlow,
  tags: ['autodocs'],
  args: {
    code: 'story-demo-code',
  },
  decorators: [
    (Story) => {
      // Every calendar `book` link carries `?duration=` — most stories want
      // a valid one; the two duration stories below override it.
      mocked(useSearchParams).mockReturnValue(
        fakeSearchParams({ duration: '1800' })
      );
      return (
        <QueryClientProvider client={makeQueryClient()}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof PublicBookingFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Bookable slots loaded — the picker's normal state. */
export const BookableSlots: Story = {
  decorators: [
    (Story) => {
      mocked(usePublicBookableSlots).mockReturnValue({
        data: PROPOSALS,
        isLoading: false,
        isError: false,
        error: null,
        refetch: fn(),
      } as unknown as ReturnType<typeof usePublicBookableSlots>);
      return <Story />;
    },
  ],
};

export const Loading: Story = {
  decorators: [
    (Story) => {
      mocked(usePublicBookableSlots).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: fn(),
      } as unknown as ReturnType<typeof usePublicBookableSlots>);
      return <Story />;
    },
  ],
};

/**
 * Every code failure on the READ path — invalid, expired, used, revoked,
 * wrong-scope — collapses into this one opaque state (see the plan's "The
 * opaque 403 is not an auth failure" guiding decision). Never differentiate.
 */
export const LinkInvalid: Story = {
  decorators: [
    (Story) => {
      mocked(usePublicBookableSlots).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new PublicReadFailureError('link-invalid'),
        refetch: fn(),
      } as unknown as ReturnType<typeof usePublicBookableSlots>);
      return <Story />;
    },
  ],
};

/**
 * A non-403 read failure (network error, 5xx) — says nothing about the
 * code's validity, so it renders a generic retryable error rather than
 * `LinkInvalid`. Covers the `data-testid='slots-load-error'` branch.
 */
export const SlotsLoadError: Story = {
  decorators: [
    (Story) => {
      mocked(usePublicBookableSlots).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new PublicReadFailureError('error'),
        refetch: fn(),
      } as unknown as ReturnType<typeof usePublicBookableSlots>);
      return <Story />;
    },
  ],
};

/**
 * No `?duration=` at all — a broken/hand-edited link, not a code-validity
 * question, so this must never route through `LinkInvalid`. Covers the
 * `data-testid='invalid-duration'` branch.
 */
export const MissingDuration: Story = {
  decorators: [
    (Story) => {
      mocked(useSearchParams).mockReturnValue(fakeSearchParams());
      return <Story />;
    },
  ],
};

/** A non-numeric `?duration=` renders the same missing-duration card. */
export const MalformedDuration: Story = {
  decorators: [
    (Story) => {
      mocked(useSearchParams).mockReturnValue(
        fakeSearchParams({ duration: 'not-a-number' })
      );
      return <Story />;
    },
  ],
};
