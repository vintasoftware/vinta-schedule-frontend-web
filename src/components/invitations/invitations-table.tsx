'use client';

import * as React from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
import { Badge } from '@/components/ui/badge';
import { VStack, Text } from '@/components/layout';
import { zonedFormat } from '@/lib/datetime';
import {
  useInvitations,
  type Invitation,
} from '@/hooks/invitations/use-invitations';

// ---------------------------------------------------------------------------
// Column definitions
// Exported so stories and sibling modules can import them directly rather than
// duplicating the definitions (which would let them silently drift).
// ---------------------------------------------------------------------------

export const STATUS_VARIANT: Record<Invitation['status'], 'info' | 'warning'> =
  {
    pending: 'info',
    accepted: 'warning', // unlikely but shown for completeness
  };

export const COLUMNS: DataTableColumn<Invitation>[] = [
  {
    accessorKey: 'email',
    id: 'email',
    header: 'Email',
    // The /invitations/ endpoint has no ordering param — disable sort.
    enableSorting: false,
    cell: ({ row }) => <Text weight='medium'>{row.original.email}</Text>,
  },
  {
    accessorKey: 'expiresAt',
    id: 'expiresAt',
    header: 'Expires',
    enableSorting: false,
    cell: ({ row }) => (
      <Text color='muted-foreground' size='sm'>
        {zonedFormat(row.original.expiresAt, 'UTC', 'MMM d, yyyy')}
      </Text>
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
// InvitationsTableEmpty — custom empty state
// ---------------------------------------------------------------------------

function InvitationsTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No pending invitations.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// InvitationsTableInner — renders inside the DataTableQueryBoundary (needs useSearchParams).
// ---------------------------------------------------------------------------

function InvitationsTableInner() {
  const { query, setPage, setSearch, setOrdering } = useDataTableQuery();

  const handleQueryChange = React.useCallback(
    (next: typeof query) => {
      if (next.page !== query.page) setPage(next.page);
      if (next.search !== query.search) setSearch(next.search);
      if (next.ordering !== query.ordering) setOrdering(next.ordering);
    },
    [query, setPage, setSearch, setOrdering]
  );

  const { invitations, totalCount, isLoading, isError, error } =
    useInvitations(query);

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load invitations.
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
    <DataTable<Invitation>
      data={invitations}
      columns={COLUMNS}
      query={query}
      onQueryChange={handleQueryChange}
      totalCount={totalCount}
      isLoading={isLoading}
      emptyState={<InvitationsTableEmpty />}
      showSearch={true}
    />
  );
}

// ---------------------------------------------------------------------------
// InvitationsTable — exported composition.
//
// Must be rendered inside a DataTableQueryBoundary (the page does this) because
// InvitationsTableInner calls useDataTableQuery which calls useSearchParams.
// ---------------------------------------------------------------------------

export function InvitationsTable() {
  return <InvitationsTableInner />;
}
