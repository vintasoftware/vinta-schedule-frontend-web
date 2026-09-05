import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PoolDialog } from './pool-dialog';
import { STORY_POOLS, makeStoryFetch } from './fixtures';

const meta = {
  title: 'Components/CalendarPools/PoolDialog',
  component: PoolDialog,
  parameters: { layout: 'centered' },
  args: {
    open: true,
    onOpenChange: () => {},
  },
  decorators: [
    (Story) => {
      global.fetch = makeStoryFetch() as typeof global.fetch;
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof PoolDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};

/** Edit mode: prefilled, and carrying the shared-roster warning. */
export const Edit: Story = {
  args: { pool: STORY_POOLS[0] },
};

export const EditMobile: Story = {
  args: { pool: STORY_POOLS[0] },
  globals: { viewport: { value: 'mobile' } },
};
