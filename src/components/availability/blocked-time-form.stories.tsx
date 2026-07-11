/**
 * Storybook stories for BlockedTimeForm.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { BlockedTimeForm } from './blocked-time-form';
import * as useBlockedTimesModule from '@/hooks/availability/use-blocked-times';

const meta = {
  title: 'Availability/BlockedTimeForm',
  component: BlockedTimeForm,
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
          <div className='w-full max-w-2xl'>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof BlockedTimeForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state: ready for one-off blocked time creation.
 */
export const Default: Story = {
  args: {},
  decorators: [
    (Story) => {
      vi.spyOn(useBlockedTimesModule, 'useBlockedTimes').mockReturnValue({
        blockedTimes: [],
        isLoading: false,
        isError: false,
        error: null,
        blockedTimesQuery: {
          data: { results: [] },
        } as unknown as never,
        createBlockedTime: vi.fn().mockResolvedValue(undefined),
        createRecurringBlockedTime: vi.fn().mockResolvedValue(undefined),
        bulkCreateMutation: {} as unknown as never,
        isPending: false,
      });
      return <Story />;
    },
  ],
};

/**
 * Loading state: form is disabled while submitting.
 */
export const Loading: Story = {
  args: {},
  decorators: [
    (Story) => {
      vi.spyOn(useBlockedTimesModule, 'useBlockedTimes').mockReturnValue({
        blockedTimes: [],
        isLoading: false,
        isError: false,
        error: null,
        blockedTimesQuery: {
          data: { results: [] },
        } as unknown as never,
        createBlockedTime: vi.fn(),
        createRecurringBlockedTime: vi.fn(),
        bulkCreateMutation: {} as unknown as never,
        isPending: true,
      });
      return <Story />;
    },
  ],
};

/**
 * With a specific calendar association.
 */
export const WithCalendarId: Story = {
  args: {
    calendarId: 42,
  },
  decorators: [
    (Story) => {
      vi.spyOn(useBlockedTimesModule, 'useBlockedTimes').mockReturnValue({
        blockedTimes: [],
        isLoading: false,
        isError: false,
        error: null,
        blockedTimesQuery: {
          data: { results: [] },
        } as unknown as never,
        createBlockedTime: vi.fn().mockResolvedValue(undefined),
        createRecurringBlockedTime: vi.fn().mockResolvedValue(undefined),
        bulkCreateMutation: {} as unknown as never,
        isPending: false,
      });
      return <Story />;
    },
  ],
};
