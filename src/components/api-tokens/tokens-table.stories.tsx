'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableQuery } from '@/components/data-table/types';
import { DEFAULT_DATA_TABLE_QUERY } from '@/components/data-table/types';
import { VStack, Text } from '@/components/layout';
import type { SystemUserToken } from '@/hooks/api-tokens/use-public-api-tokens';
import { COLUMNS } from './tokens-table';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const ALL_TOKENS: SystemUserToken[] = [
  {
    id: 1,
    integration_name: 'CI Pipeline',
    is_active: true,
    available_resources: ['calendar_event', 'calendar'],
    scoped_to_user: null,
  },
  {
    id: 2,
    integration_name: 'Analytics Dashboard',
    is_active: true,
    available_resources: ['calendar_event', 'attendance', 'user'],
    scoped_to_user: null,
  },
  {
    id: 3,
    integration_name: 'Legacy Integration',
    is_active: false,
    available_resources: ['calendar'],
    scoped_to_user: null,
  },
];

// ---------------------------------------------------------------------------
// Story wrapper — useState instead of useDataTableQuery; no router needed.
// ---------------------------------------------------------------------------

function TokensTableStory({
  data = ALL_TOKENS,
  totalCount,
  isLoading = false,
}: {
  data?: SystemUserToken[];
  totalCount?: number;
  isLoading?: boolean;
}) {
  const [query, setQuery] = React.useState<DataTableQuery>({
    ...DEFAULT_DATA_TABLE_QUERY,
    pageSize: 10,
  });
  const count = totalCount ?? data.length;

  const empty = (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No API tokens found.
      </Text>
    </VStack>
  );

  return (
    <div className='p-6'>
      <DataTable<SystemUserToken>
        data={data}
        columns={COLUMNS}
        query={query}
        onQueryChange={setQuery}
        totalCount={count}
        isLoading={isLoading}
        emptyState={empty}
        showSearch={false}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/ApiTokens/TokensTable',
  component: TokensTableStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof TokensTableStory>;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Populated: Story = {
  render: () => <TokensTableStory />,
};

export const Empty: Story = {
  render: () => <TokensTableStory data={[]} totalCount={0} />,
};

export const Loading: Story = {
  render: () => <TokensTableStory data={[]} isLoading />,
};
