/**
 * Storybook stories for UserAvailabilityView.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserAvailabilityView } from './user-availability-view';

const meta = {
  title: 'Availability/UserAvailabilityView',
  component: UserAvailabilityView,
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
          <div className='w-full max-w-2xl'>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof UserAvailabilityView>;

export default meta;
type Story = StoryObj;

/**
 * Default state — empty inputs, no results.
 */
export const Default: Story = {};

/**
 * Mobile viewport variant.
 */
export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile' },
  },
};
