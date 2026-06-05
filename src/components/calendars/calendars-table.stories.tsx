import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarsTable } from './calendars-table';

const meta: Meta<typeof CalendarsTable> = {
  title: 'components/Calendars/CalendarsTable',
  component: CalendarsTable,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => {
      const queryClient = new QueryClient();
      return (
        <QueryClientProvider client={queryClient}>
          <div className='p-6'>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof CalendarsTable>;

/**
 * Populated state: showing a list of calendars with various types and providers.
 */
export const Populated: Story = {
  render: () => {
    // Use MSW mock to intercept the API call
    return <CalendarsTable />;
  },
  parameters: {
    msw: {
      handlers: [],
    },
  },
};

/**
 * Empty state: when the user has no calendars.
 */
export const Empty: Story = {
  render: () => {
    return <CalendarsTable />;
  },
};

/**
 * Loading state: while calendars are being fetched.
 */
export const Loading: Story = {
  render: () => {
    return <CalendarsTable />;
  },
};
