import * as React from 'react';
import type { StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoomsSyncSettingsForm } from './rooms-sync-settings-form';

const queryClient = new QueryClient();

const meta = {
  title: 'Sync / Rooms Sync Settings Form',
  component: RoomsSyncSettingsForm,
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
 * Default state: rooms sync is disabled.
 */
export const Default: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

/**
 * Rooms sync is enabled.
 */
export const Enabled: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

/**
 * Form is in a loading state (save button disabled).
 */
export const Loading: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};
