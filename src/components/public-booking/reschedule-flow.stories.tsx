import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn, mocked, userEvent, within, waitFor, expect } from 'storybook/test';
import { useSearchParams } from 'next/navigation';
import type { BookableSlotProposal } from '@/client';
import {
  PublicReadFailureError,
  PublicWriteFailureError,
} from '@/lib/booking-links/errors';
// Mocked in .storybook/preview.tsx via `sb.mock(...)`; `mocked()` just types
// it — same rationale as `public-booking-flow.stories.tsx`.
import { usePublicBookableSlots } from '@/hooks/booking-codes/use-public-bookable-slots';
import { usePublicGroupBookableSlots } from '@/hooks/booking-codes/use-public-group-booking';
import { usePublicReschedule } from '@/hooks/booking-codes/use-public-reschedule';
import { RescheduleFlow } from './reschedule-flow';

/**
 * A stand-in for `next/navigation`'s `ReadonlyURLSearchParams` — see
 * `public-booking-flow.stories.tsx`'s identical helper for why this file
 * constructs a plain `URLSearchParams` instead of importing the real class
 * (the `@storybook/nextjs-vite` build's pre-bundled `next/navigation` mock
 * does not re-export it at runtime).
 */
function fakeSearchParams(
  init?: ConstructorParameters<typeof URLSearchParams>[0]
): ReturnType<typeof useSearchParams> {
  return new URLSearchParams(init) as unknown as ReturnType<
    typeof useSearchParams
  >;
}

// This story covers the READ states directly through the mocked hooks (same
// split as `public-booking-flow.stories.tsx`), PLUS the terminal
// write-error state — the phase spec calls out terminal states explicitly,
// unlike Phase 2/3's stories. Reaching a terminal state needs a real
// interaction (pick a slot, confirm), so those two stories use a `play`
// function against a stubbed `usePublicReschedule`.

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
  title: 'Components/PublicBooking/RescheduleFlow',
  component: RescheduleFlow,
  tags: ['autodocs'],
  args: {
    code: 'story-demo-code',
  },
  decorators: [
    (Story) => {
      // A calendar-scoped reschedule link always carries `?target=calendar`
      // and `?duration=` — most stories want a valid pair; the
      // MissingDuration story and the Group stories override this.
      mocked(useSearchParams).mockReturnValue(
        fakeSearchParams({ target: 'calendar', duration: '1800' })
      );
      return (
        <QueryClientProvider client={makeQueryClient()}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof RescheduleFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Bookable slots loaded for a calendar-scoped reschedule link. */
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
 * A group-scoped reschedule link (`?target=group`) reads via
 * `usePublicGroupBookableSlots` instead — the single-calendar hook is never
 * even called for it (see `reschedule-flow.tsx`'s "no probing" doc comment).
 */
export const GroupBookableSlots: Story = {
  decorators: [
    (Story) => {
      mocked(useSearchParams).mockReturnValue(
        fakeSearchParams({ target: 'group' })
      );
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

/**
 * Every code failure on the READ path — invalid, expired, used, revoked,
 * wrong-scope — collapses into this one opaque state. Never differentiate.
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
 * A non-403 read failure (network error, 5xx) — renders a generic retryable
 * error rather than `LinkInvalid`.
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
 * No `?duration=` on a calendar-scoped link — a broken/hand-edited link, not
 * a code-validity question.
 */
export const MissingDuration: Story = {
  decorators: [
    (Story) => {
      mocked(useSearchParams).mockReturnValue(
        fakeSearchParams({ target: 'calendar' })
      );
      return <Story />;
    },
  ],
};

/**
 * `ALREADY_USED` on the reschedule WRITE is terminal, and worded distinctly
 * (via `terminalErrorCopy`, shared with the book flow) from the READ path's
 * opaque `LinkInvalid` copy. Reached by actually picking a slot and
 * confirming against a stubbed, rejecting `usePublicReschedule`.
 */
export const TerminalErrorAlreadyUsed: Story = {
  decorators: [
    (Story) => {
      mocked(usePublicBookableSlots).mockReturnValue({
        data: PROPOSALS,
        isLoading: false,
        isError: false,
        error: null,
        refetch: fn(),
      } as unknown as ReturnType<typeof usePublicBookableSlots>);
      mocked(usePublicReschedule).mockReturnValue({
        reschedule: fn().mockRejectedValue(
          new PublicWriteFailureError({
            errorCode: 'ALREADY_USED',
            detail: 'This booking code has already been used.',
            isRetryable: false,
          })
        ),
        rescheduleMutation: { isPending: false },
      } as unknown as ReturnType<typeof usePublicReschedule>);
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('radio'));
    await userEvent.click(canvas.getByTestId('reschedule-confirm'));
    await waitFor(() =>
      expect(canvas.getByTestId('reschedule-terminal-error')).toBeTruthy()
    );
  },
};
