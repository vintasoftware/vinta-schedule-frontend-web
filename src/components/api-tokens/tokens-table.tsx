'use client';

import * as React from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
import { Badge } from '@/components/ui/badge';
import { Flex, VStack, Text } from '@/components/layout';
import { usePublicApiTokens } from '@/hooks/api-tokens/use-public-api-tokens';
import type { SystemUserToken } from '@/hooks/api-tokens/use-public-api-tokens';

// ---------------------------------------------------------------------------
// Column definitions
// Exported so stories and tests can import them directly.
// SECURITY: NO secret/token column — list endpoint returns metadata only.
// ---------------------------------------------------------------------------

export const COLUMNS: DataTableColumn<SystemUserToken>[] = [
  {
    accessorKey: 'integration_name',
    id: 'integration_name',
    header: 'Name',
    enableSorting: false,
    cell: ({ row }) => (
      <Text weight='medium'>{row.original.integration_name}</Text>
    ),
  },
  {
    accessorKey: 'available_resources',
    id: 'available_resources',
    header: 'Scopes',
    enableSorting: false,
    cell: ({ row }) => (
      <Flex wrap gap={1}>
        {row.original.available_resources.length === 0 ? (
          <Text color='muted-foreground' size='sm'>
            —
          </Text>
        ) : (
          row.original.available_resources.map((r) => (
            <Badge key={r} variant='secondary' className='text-xs'>
              {r}
            </Badge>
          ))
        )}
      </Flex>
    ),
  },
  {
    accessorKey: 'is_active',
    id: 'is_active',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.is_active ? (
        <Badge variant='success'>Active</Badge>
      ) : (
        <Badge variant='secondary'>Inactive</Badge>
      ),
  },
];

// ---------------------------------------------------------------------------
// TokensTableEmpty — custom empty state
// ---------------------------------------------------------------------------

function TokensTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No API tokens found.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// TokensTableInner — renders inside the DataTableQueryBoundary.
// ---------------------------------------------------------------------------

interface TokensTableInnerProps {
  toolbarActions?: React.ReactNode;
}

function TokensTableInner({ toolbarActions }: TokensTableInnerProps) {
  const { query, setPage, setSearch, setOrdering } = useDataTableQuery();

  const handleQueryChange = React.useCallback(
    (next: typeof query) => {
      if (next.page !== query.page) setPage(next.page);
      if (next.search !== query.search) setSearch(next.search);
      if (next.ordering !== query.ordering) setOrdering(next.ordering);
    },
    [query, setPage, setSearch, setOrdering]
  );

  const { tokens, totalCount, isLoading, isError, error } = usePublicApiTokens({
    query,
  });

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load API tokens.
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
    <DataTable<SystemUserToken>
      data={tokens}
      columns={COLUMNS}
      query={query}
      onQueryChange={handleQueryChange}
      totalCount={totalCount}
      isLoading={isLoading}
      emptyState={<TokensTableEmpty />}
      showSearch={false}
      toolbarActions={toolbarActions}
    />
  );
}

// ---------------------------------------------------------------------------
// TokensTable — exported composition.
//
// Must be rendered inside a DataTableQueryBoundary (the page does this) because
// TokensTableInner calls useDataTableQuery which calls useSearchParams.
// ---------------------------------------------------------------------------

export interface TokensTableProps {
  /** Extra toolbar content (e.g. "New token" button). */
  toolbarActions?: React.ReactNode;
}

export function TokensTable({ toolbarActions }: TokensTableProps) {
  return <TokensTableInner toolbarActions={toolbarActions} />;
}
