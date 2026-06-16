'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableQuery } from '@/components/data-table/types';
import { DEFAULT_DATA_TABLE_QUERY } from '@/components/data-table/types';
import { VStack, Text } from '@/components/layout';
import type { TeamMember } from '@/hooks/team/use-team-members';
// Import canonical columns/variants from the component so they can't drift.
import { createColumns } from './team-table';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const ALL_MEMBERS: TeamMember[] = [
  {
    id: 1,
    name: 'Alice Souza',
    email: 'alice@acme.com',
    role: 'admin',
    status: 'active',
  },
  {
    id: 2,
    name: 'Bob Lima',
    email: 'bob@acme.com',
    role: 'member',
    status: 'active',
  },
  {
    id: 3,
    name: 'Carol Maia',
    email: 'carol@acme.com',
    role: 'member',
    status: 'active',
  },
  {
    id: 4,
    name: 'David Cruz',
    email: 'david@acme.com',
    role: 'member',
    status: 'active',
  },
  {
    id: 5,
    name: 'Eva Pinto',
    email: 'eva@acme.com',
    role: 'member',
    status: 'disabled',
  },
];

// ---------------------------------------------------------------------------
// Story wrapper — uses plain useState (no useSearchParams) so no router needed.
// ---------------------------------------------------------------------------

function TeamTableStory({
  data = ALL_MEMBERS,
  totalCount,
  isLoading = false,
}: {
  data?: TeamMember[];
  totalCount?: number;
  isLoading?: boolean;
}) {
  const [query, setQuery] = React.useState<DataTableQuery>({
    ...DEFAULT_DATA_TABLE_QUERY,
    pageSize: 5,
  });

  const count = totalCount ?? data.length;

  const empty = (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No team members found.
      </Text>
    </VStack>
  );

  // Create columns with no-op action handlers for Storybook.
  const columns = React.useMemo(
    () =>
      createColumns(
        new Set(),
        async () => {},
        async () => {},
        async () => {}
      ),
    []
  );

  return (
    <div className='p-6'>
      <DataTable<TeamMember>
        data={data}
        columns={columns}
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
  title: 'Components/TeamTable',
  component: TeamTableStory,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof TeamTableStory>;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Populated — five members across two roles and two statuses. */
export const Populated: Story = {
  render: () => <TeamTableStory />,
};

/** Empty — no members, custom empty-state visible. */
export const Empty: Story = {
  render: () => <TeamTableStory data={[]} totalCount={0} />,
};

/** Loading — skeleton rows while data is fetching. */
export const Loading: Story = {
  render: () => <TeamTableStory data={[]} isLoading />,
};
