import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { serviceAccountsListQueryKey } from '@/client/@tanstack/react-query.gen';
import { ServiceAccountCard } from './service-account-card';

const meta = {
  component: ServiceAccountCard,
  title: 'Sync / Service Account Card',
  tags: ['autodocs'],
} satisfies Meta<typeof ServiceAccountCard>;

export default meta;
type Story = StoryObj;

/**
 * The card as it appears when no service account has been configured yet.
 * Shows empty state and a "Configure" CTA.
 */
export const NotConfigured: Story = {
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      // Seed an empty list so the card renders in "not configured" state.
      queryClient.setQueryData(
        serviceAccountsListQueryKey({ query: { limit: 1 } }),
        { count: 0, results: [] }
      );
      return (
        <QueryClientProvider client={queryClient}>
          <div className='max-w-md p-6'>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
};

/**
 * The card as it appears when a service account is already configured.
 * Shows email, audience, badge, and Rotate / Remove actions.
 */
export const Configured: Story = {
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      // Seed a configured service account so the card shows details.
      queryClient.setQueryData(
        serviceAccountsListQueryKey({ query: { limit: 1 } }),
        {
          count: 1,
          results: [
            {
              id: 1,
              email: 'my-sa@my-project.iam.gserviceaccount.com',
              audience: 'https://calendar.google.com/',
              configured: true,
              created: '2024-01-15T10:00:00Z',
              modified: '2024-06-01T08:30:00Z',
            },
          ],
        }
      );
      return (
        <QueryClientProvider client={queryClient}>
          <div className='max-w-md p-6'>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
};
