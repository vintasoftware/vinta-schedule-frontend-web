'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DataTable } from '@/components/data-table/data-table';
import type {
  DataTableColumn,
  DataTableQuery,
} from '@/components/data-table/types';
import { DEFAULT_DATA_TABLE_QUERY } from '@/components/data-table/types';
import { Badge } from '@/components/ui/badge';
import { VStack, Text } from '@/components/layout';
import type { TeamMember } from '@/hooks/team/use-team-members';

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
// Column definitions (mirrors team-table.tsx but self-contained for stories)
// ---------------------------------------------------------------------------

const ROLE_VARIANT: Record<TeamMember['role'], 'default' | 'secondary'> = {
  admin: 'default',
  member: 'secondary',
};

const STATUS_VARIANT: Record<TeamMember['status'], 'success' | 'danger'> = {
  active: 'success',
  disabled: 'danger',
};

const COLUMNS: DataTableColumn<TeamMember>[] = [
  {
    accessorKey: 'name',
    id: 'name',
    header: 'Name',
    enableSorting: false,
    cell: ({ row }) => <span className='font-medium'>{row.original.name}</span>,
  },
  {
    accessorKey: 'email',
    id: 'email',
    header: 'Email',
    enableSorting: false,
    cell: ({ row }) => (
      <span className='text-muted-foreground'>{row.original.email}</span>
    ),
  },
  {
    accessorKey: 'role',
    id: 'role',
    header: 'Role',
    enableSorting: false,
    cell: ({ row }) => (
      <Badge variant={ROLE_VARIANT[row.original.role]}>
        {row.original.role}
      </Badge>
    ),
  },
  {
    accessorKey: 'status',
    id: 'status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status]}>
        {row.original.status}
      </Badge>
    ),
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

  return (
    <div className='p-6'>
      <DataTable<TeamMember>
        data={data}
        columns={COLUMNS}
        query={query}
        onQueryChange={setQuery}
        totalCount={count}
        isLoading={isLoading}
        emptyState={empty}
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
