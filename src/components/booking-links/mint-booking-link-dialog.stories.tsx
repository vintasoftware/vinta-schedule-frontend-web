import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn, mocked } from 'storybook/test';
import {
  MintBookingLinkDialog,
  type MintBookingLinkTarget,
} from './mint-booking-link-dialog';
// Mocked in .storybook/preview.tsx via `sb.mock(...)`; `mocked()` just types it.
import { useCurrentOrganization } from '@/hooks/organizations/use-current-organization';

// This dialog's other two states — the one-time reveal and the revoked
// state — are reached only by actually submitting the form and calling
// revoke, which this repo's stories don't drive through interaction (compare
// `new-token-dialog.stories.tsx`, the sibling one-time-credential dialog,
// which likewise stops at the form view for the same reason). That coverage
// lives in the colocated `mint-booking-link-dialog.test.tsx` instead, which
// exercises both states end to end, including the one-time-reveal wording,
// the revoke call, and the code being gone after close.

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

const CALENDAR_TARGET: MintBookingLinkTarget = {
  kind: 'calendar',
  id: 5,
  name: 'Dr. Smith',
};

const GROUP_TARGET: MintBookingLinkTarget = {
  kind: 'group',
  id: 9,
  name: 'Surgery Team',
};

const meta = {
  title: 'Components/BookingLinks/MintBookingLinkDialog',
  component: MintBookingLinkDialog,
  tags: ['autodocs'],
  args: {
    open: true,
    onOpenChange: fn(),
    target: CALENDAR_TARGET,
  },
  decorators: [
    (Story) => {
      mocked(useCurrentOrganization).mockReturnValue({
        organization: { slug: 'acme' },
        isOnboarded: true,
        isGated: false,
        isDisabled: false,
        membership: null,
        permissions: [],
        isLoading: false,
        isError: false,
        error: null,
        query: {} as unknown as never,
      } as unknown as ReturnType<typeof useCurrentOrganization>);
      return (
        <QueryClientProvider client={makeQueryClient()}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof MintBookingLinkDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A calendar target offers the advisory duration control. */
export const CalendarTarget: Story = {};

/**
 * A group target shows no duration control — the group's own server-pinned
 * duration applies (see the plan's "Group duration comes from the server"
 * guiding decision).
 */
export const GroupTarget: Story = {
  args: { target: GROUP_TARGET },
};
