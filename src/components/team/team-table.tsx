'use client';

import * as React from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
import { Badge } from '@/components/ui/badge';
import { VStack, Text } from '@/components/layout';
import { useTeamMembers, type TeamMember } from '@/hooks/team/use-team-members';

// ---------------------------------------------------------------------------
// Column definitions
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
    // The /organization-members/ endpoint has no ordering param — disable sort.
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
// TeamTableEmpty — custom empty state
// ---------------------------------------------------------------------------

function TeamTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No team members found.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// TeamTableInner — renders inside the DataTableQueryBoundary (needs useSearchParams).
// ---------------------------------------------------------------------------

function TeamTableInner() {
  const { query, setPage, setSearch, setOrdering } = useDataTableQuery();

  const handleQueryChange = React.useCallback(
    (next: typeof query) => {
      if (next.page !== query.page) setPage(next.page);
      if (next.search !== query.search) setSearch(next.search);
      if (next.ordering !== query.ordering) setOrdering(next.ordering);
    },
    [query, setPage, setSearch, setOrdering]
  );

  const { members, totalCount, isLoading, isError, error } =
    useTeamMembers(query);

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load team members.
        </Text>
        <Text color='muted-foreground' size='sm'>
          {error instanceof Error
            ? error.message
            : 'An unexpected error occurred.'}
        </Text>
      </VStack>
    );
  }

  return (
    <DataTable<TeamMember>
      data={members}
      columns={COLUMNS}
      query={query}
      onQueryChange={handleQueryChange}
      totalCount={totalCount}
      isLoading={isLoading}
      emptyState={<TeamTableEmpty />}
    />
  );
}

// ---------------------------------------------------------------------------
// TeamTable — exported composition.
//
// Must be rendered inside a DataTableQueryBoundary (the page does this) because
// TeamTableInner calls useDataTableQuery which calls useSearchParams.
// ---------------------------------------------------------------------------

export function TeamTable() {
  return <TeamTableInner />;
}
