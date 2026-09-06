import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn, mocked } from 'storybook/test';
import { useSearchParams } from 'next/navigation';
// Mocked in .storybook/preview.tsx via `sb.mock(...)` — stubbed here so
// these stories never attempt a real `/public/booking/*` fetch, same
// rationale as `public-booking-flow.stories.tsx` /
// `public-group-booking-flow.stories.tsx`.
import { usePublicBookableSlots } from '@/hooks/booking-codes/use-public-bookable-slots';
import { usePublicGroupBookableSlots } from '@/hooks/booking-codes/use-public-group-booking';
import { PublicBookingEntry } from './public-booking-entry';

// Proves the routing decision visually: the same component, only the
// `?target=` marker differs, mounts a completely different flow — with no
// loading/probing step in between.

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

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const meta = {
  title: 'Components/PublicBooking/PublicBookingEntry',
  component: PublicBookingEntry,
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
} satisfies Meta<typeof PublicBookingEntry>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `?target=calendar&duration=1800` mounts the single-calendar flow. */
export const CalendarTarget: Story = {
  decorators: [
    (Story) => {
      mocked(useSearchParams).mockReturnValue(
        fakeSearchParams({ target: 'calendar', duration: '1800' })
      );
      mocked(usePublicBookableSlots).mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: fn(),
      } as unknown as ReturnType<typeof usePublicBookableSlots>);
      return <Story />;
    },
  ],
};

/** `?target=group` mounts the calendar-group flow. */
export const GroupTarget: Story = {
  decorators: [
    (Story) => {
      mocked(useSearchParams).mockReturnValue(
        fakeSearchParams({ target: 'group' })
      );
      mocked(usePublicGroupBookableSlots).mockReturnValue({
        data: [],
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
 * A pre-Phase-3 link — `?duration=` with no `?target=` at all — still
 * resolves to the calendar flow (back-compat default).
 */
export const PreExistingCalendarLink: Story = {
  decorators: [
    (Story) => {
      mocked(useSearchParams).mockReturnValue(
        fakeSearchParams({ duration: '1800' })
      );
      mocked(usePublicBookableSlots).mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: fn(),
      } as unknown as ReturnType<typeof usePublicBookableSlots>);
      return <Story />;
    },
  ],
};
