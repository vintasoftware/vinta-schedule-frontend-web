'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Plus } from 'lucide-react';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { PoolsTable } from './pools-table';
import { STORY_POOLS, makeStoryFetch } from './fixtures';

const meta = {
  title: 'Components/CalendarPools/PoolsTable',
  component: PoolsTable,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PoolsTable>;

export default meta;
type Story = StoryObj;

function Harness({
  pools = STORY_POOLS,
  withToolbar = true,
}: {
  pools?: typeof STORY_POOLS;
  withToolbar?: boolean;
}) {
  global.fetch = makeStoryFetch(pools) as typeof global.fetch;
  const [queryClient] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className='p-6'>
        <DataTableQueryBoundary>
          <PoolsTable
            toolbarActions={
              withToolbar ? (
                <Button size='sm'>
                  <Plus />
                  New pool
                </Button>
              ) : undefined
            }
          />
        </DataTableQueryBoundary>
      </div>
    </QueryClientProvider>
  );
}

export const Populated: Story = {
  render: () => <Harness />,
};

export const Empty: Story = {
  render: () => <Harness pools={[]} />,
};

export const Mobile: Story = {
  render: () => <Harness />,
  globals: { viewport: { value: 'mobile' } },
};
