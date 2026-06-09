import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NewTokenDialog } from './new-token-dialog';

const meta = {
  title: 'Components/ApiTokens/NewTokenDialog',
  component: NewTokenDialog,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: () => {},
  },
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof NewTokenDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
