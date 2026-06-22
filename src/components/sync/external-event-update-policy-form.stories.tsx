import * as React from 'react';
import type { StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExternalEventUpdatePolicyForm } from './external-event-update-policy-form';

const queryClient = new QueryClient();

const meta = {
  title: 'Sync / External Event Update Policy Form',
  component: ExternalEventUpdatePolicyForm,
  decorators: [
    (Story: React.ComponentType<Record<string, never>>) => (
      <QueryClientProvider client={queryClient}>
        <div className='mx-auto max-w-2xl p-6'>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state — no organization data loaded, so the radio group falls back to
 * the backend default policy (Create change requests). The Save button is
 * disabled until a different option is selected.
 */
export const Default: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};
