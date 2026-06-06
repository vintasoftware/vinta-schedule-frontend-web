import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TriggerOrgCalendarSyncButton } from './trigger-org-calendar-sync-button';

const meta = {
  component: TriggerOrgCalendarSyncButton,
  title: 'Sync / Trigger Org Calendar Sync Button',
  tags: ['autodocs'],
  /**
   * Wrap in a QueryClientProvider so the useMutation hook inside the component
   * doesn't throw "No QueryClient set" when Storybook renders the story.
   */
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
} satisfies Meta<typeof TriggerOrgCalendarSyncButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state: ready to trigger org-wide calendar sync.
 */
export const Default: Story = {};
