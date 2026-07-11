/**
 * Storybook stories for MyAvailabilityView.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MyAvailabilityView } from './my-availability-view';

const meta = {
  title: 'Availability/MyAvailabilityView',
  component: MyAvailabilityView,
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
} satisfies Meta<typeof MyAvailabilityView>;

export default meta;
type Story = StoryObj;

/**
 * Default — renders with whatever the live API returns.
 * The component fetches its own data via useMyAvailability.
 */
export const Default: Story = {};

/**
 * Mobile viewport.
 */
export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile' },
  },
};
