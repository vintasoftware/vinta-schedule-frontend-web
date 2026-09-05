import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn, mocked, userEvent, within, waitFor, expect } from 'storybook/test';
import { PublicWriteFailureError } from '@/lib/booking-links/errors';
// Mocked in .storybook/preview.tsx via `sb.mock(...)`.
import { usePublicCancel } from '@/hooks/booking-codes/use-public-cancel';
import { CancelFlow } from './cancel-flow';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

const meta = {
  title: 'Components/PublicBooking/CancelFlow',
  component: CancelFlow,
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
} satisfies Meta<typeof CancelFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The initial confirm step — no read of any kind happens before this. */
export const ConfirmStep: Story = {};

/**
 * A successful `204` cancel. Reached by actually clicking the confirm
 * button against a stubbed, resolving `usePublicCancel`.
 */
export const Cancelled: Story = {
  decorators: [
    (Story) => {
      mocked(usePublicCancel).mockReturnValue({
        cancel: fn().mockResolvedValue(undefined),
        cancelMutation: { isPending: false },
      } as unknown as ReturnType<typeof usePublicCancel>);
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('cancel-confirm-button'));
    await waitFor(() =>
      expect(canvas.getByTestId('cancel-confirmation')).toBeTruthy()
    );
  },
};

/**
 * `ALREADY_USED` on the cancel WRITE is terminal, and worded distinctly from
 * the reschedule/book flows' opaque `LinkInvalid` copy (via the shared
 * `terminalErrorCopy`). Reached by clicking confirm against a stubbed,
 * rejecting `usePublicCancel`.
 */
export const TerminalErrorAlreadyUsed: Story = {
  decorators: [
    (Story) => {
      mocked(usePublicCancel).mockReturnValue({
        cancel: fn().mockRejectedValue(
          new PublicWriteFailureError({
            errorCode: 'ALREADY_USED',
            detail: 'This booking code has already been used.',
            isRetryable: false,
          })
        ),
        cancelMutation: { isPending: false },
      } as unknown as ReturnType<typeof usePublicCancel>);
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('cancel-confirm-button'));
    await waitFor(() =>
      expect(canvas.getByTestId('cancel-terminal-error')).toBeTruthy()
    );
  },
};
