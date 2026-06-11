import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AllCalendarsTable } from './all-calendars-table';

const meta = {
  title: 'Calendars / AllCalendarsTable',
  component: AllCalendarsTable,
  parameters: {
    layout: 'fullscreen',
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
          <div className='p-6'>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof AllCalendarsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default story showing mixed calendar types and status.
 * Demonstrates all 4 calendar types: personal, resource, virtual, bundle.
 */
export const AllCalendars: Story = {
  render: () => <AllCalendarsTable />,
};

/**
 * Empty state story.
 */
export const Empty: Story = {
  render: () => <AllCalendarsTable />,
};
