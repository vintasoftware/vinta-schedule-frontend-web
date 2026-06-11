import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateCalendarDialog } from './create-calendar-dialog';

// ---------------------------------------------------------------------------
// Storybook setup
// ---------------------------------------------------------------------------

const meta = {
  title: 'Calendars / CreateCalendarDialog',
  component: CreateCalendarDialog,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof CreateCalendarDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/**
 * Default story — the dialog is open.
 */
export const Default: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
  },
};

/**
 * Dialog closed (not visible).
 */
export const Closed: Story = {
  args: {
    open: false,
    onOpenChange: () => {},
  },
};
