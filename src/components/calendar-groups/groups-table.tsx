'use client';

import * as React from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Plus } from 'lucide-react';
import { VStack, Text } from 'vinta-schedule-design-system/layout';
import {
  useCalendarGroups,
  type CalendarGroup,
} from '@/hooks/calendar-groups/use-calendar-groups';
import { CreateGroupDialog } from './create-group-dialog';

// ---------------------------------------------------------------------------
// Column definitions
// Exported so stories and tests can import them directly.
// ---------------------------------------------------------------------------

export const COLUMNS: DataTableColumn<CalendarGroup>[] = [
  {
    accessorKey: 'name',
    id: 'name',
    header: 'Name',
    enableSorting: false,
    cell: ({ row }) => <Text weight='medium'>{row.original.name}</Text>,
  },
  {
    accessorKey: 'description',
    id: 'description',
    header: 'Description',
    enableSorting: false,
    cell: ({ row }) => (
      <Text color='muted-foreground' size='sm'>
        {row.original.description || '—'}
      </Text>
    ),
  },
  {
    accessorKey: 'slots',
    id: 'slots',
    header: 'Slots',
    enableSorting: false,
    cell: ({ row }) => (
      <Badge variant='secondary'>{row.original.slots.length}</Badge>
    ),
  },
];

// ---------------------------------------------------------------------------
// GroupsTableEmpty — custom empty state
// ---------------------------------------------------------------------------

function GroupsTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No calendar groups found.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// GroupsTableInner — renders inside the DataTableQueryBoundary.
// ---------------------------------------------------------------------------

function GroupsTableInner() {
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const { query, setPage, setSearch, setOrdering } = useDataTableQuery();

  const handleQueryChange = React.useCallback(
    (next: typeof query) => {
      if (next.page !== query.page) setPage(next.page);
      if (next.search !== query.search) setSearch(next.search);
      if (next.ordering !== query.ordering) setOrdering(next.ordering);
    },
    [query, setPage, setSearch, setOrdering]
  );

  const { groups, totalCount, isLoading, isError, error } = useCalendarGroups({
    query,
  });

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load calendar groups.
        </Text>
        <Text color='muted-foreground' size='sm'>
          {error instanceof Error
            ? error.message
            : 'An unexpected error occurred.'}
        </Text>
      </VStack>
    );
  }

  const toolbarActions = (
    <Button
      size='sm'
      onClick={() => setCreateDialogOpen(true)}
      data-testid='new-group-button'
    >
      <Plus />
      New group
    </Button>
  );

  return (
    <>
      <DataTable<CalendarGroup>
        data={groups}
        columns={COLUMNS}
        query={query}
        onQueryChange={handleQueryChange}
        totalCount={totalCount}
        isLoading={isLoading}
        emptyState={<GroupsTableEmpty />}
        showSearch={true}
        toolbarActions={toolbarActions}
      />
      <CreateGroupDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// GroupsTable — exported composition.
//
// Must be rendered inside a DataTableQueryBoundary (the page does this) because
// GroupsTableInner calls useDataTableQuery which calls useSearchParams.
// ---------------------------------------------------------------------------

export function GroupsTable() {
  return <GroupsTableInner />;
}
