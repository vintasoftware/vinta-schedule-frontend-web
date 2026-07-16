import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AvailabilityEditor } from './availability-editor';

// ---------------------------------------------------------------------------
// Storybook setup
// ---------------------------------------------------------------------------

const meta = {
  title: 'Availability / AvailabilityEditor',
  component: AvailabilityEditor,
  parameters: {
    layout: 'padded',
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
          <div className='max-w-2xl'>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof AvailabilityEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/**
 * Default story — no calendar id (member-level availability).
 */
export const Default: Story = {
  args: {
    calendarId: null,
  },
};

/**
 * Linked to a specific calendar.
 */
export const WithCalendar: Story = {
  args: {
    calendarId: 42,
  },
};
