import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransferEventDialog } from './transfer-event-dialog';
import * as React from 'react';

const meta: Meta<typeof TransferEventDialog> = {
  title: 'Events/TransferEventDialog',
  component: TransferEventDialog,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => {
      const queryClient = new QueryClient();
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TransferEventDialog>;

/**
 * Default state: dialog is open with the calendar picker.
 */
export const Default: Story = {
  args: {
    open: true,
    onOpenChange: (open) => console.log('Dialog open:', open),
    eventId: 42,
    eventTitle: 'Q4 Planning Meeting',
    onTransferred: () => console.log('Event transferred'),
  },
};

/**
 * Dialog closed state.
 */
export const Closed: Story = {
  args: {
    open: false,
    onOpenChange: (open) => console.log('Dialog open:', open),
    eventId: 42,
    eventTitle: 'Q4 Planning Meeting',
    onTransferred: () => console.log('Event transferred'),
  },
};

/**
 * With a long event title to test text wrapping.
 */
export const LongEventTitle: Story = {
  args: {
    open: true,
    onOpenChange: (open) => console.log('Dialog open:', open),
    eventId: 99,
    eventTitle:
      'Extended Q4 Planning and Budget Review Meeting with All Department Heads',
    onTransferred: () => console.log('Event transferred'),
  },
};
