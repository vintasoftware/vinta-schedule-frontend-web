'use client';

/**
 * BundlesTable — displays org bundles in a searchable, paginated datatable.
 *
 * Fetches bundles (calendars with calendar_type === 'bundle') via useAllCalendars,
 * filters client-side to show only bundle type, and displays them in a DataTable
 * with columns: Name, Actions (Edit).
 */

import * as React from 'react';
import type { Calendar } from '@/client';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableColumn } from '@/components/data-table/types';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import { useAllCalendars } from '@/hooks/calendars/use-all-calendars';
import { VStack, Text, HStack } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Plus, Pencil } from 'lucide-react';
import { CreateBundleDialog } from './create-bundle-dialog';
import { EditBundleDialog } from './edit-bundle-dialog';

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function makeColumns(
  onEditClick: (bundle: Calendar) => void
): DataTableColumn<Calendar>[] {
  return [
    {
      accessorKey: 'name',
      id: 'name',
      header: 'Name',
      enableSorting: false,
      cell: ({ row }) => <Text weight='medium'>{row.original.name}</Text>,
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <HStack gap={2}>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onEditClick(row.original)}
            aria-label={`Edit ${row.original.name}`}
            data-testid={`edit-bundle-${row.original.id}`}
          >
            <Pencil className='h-4 w-4' />
          </Button>
        </HStack>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// BundlesTableEmpty — custom empty state
// ---------------------------------------------------------------------------

function BundlesTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No bundles created yet.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// BundlesTableInner — renders inside the DataTableQueryBoundary.
// ---------------------------------------------------------------------------

function BundlesTableInner() {
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [selectedBundle, setSelectedBundle] = React.useState<Calendar | null>(
    null
  );
  const { query, setPage, setSearch, setOrdering } = useDataTableQuery();

  const handleQueryChange = React.useCallback(
    (next: typeof query) => {
      if (next.page !== query.page) setPage(next.page);
      if (next.search !== query.search) setSearch(next.search);
      if (next.ordering !== query.ordering) setOrdering(next.ordering);
    },
    [query, setPage, setSearch, setOrdering]
  );

  const handleEditClick = React.useCallback((bundle: Calendar) => {
    setSelectedBundle(bundle);
    setEditDialogOpen(true);
  }, []);

  const { calendars, isLoading, isError, error } = useAllCalendars(query);

  // Filter to bundles only (calendar_type === 'bundle').
  const bundles = React.useMemo(
    () => calendars.filter((cal) => cal.calendar_type === 'bundle'),
    [calendars]
  );

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load bundles.
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
      data-testid='new-bundle-button'
    >
      <Plus className='mr-1 h-4 w-4' />
      New bundle
    </Button>
  );

  const columns = makeColumns(handleEditClick);

  return (
    <>
      <DataTable<Calendar>
        data={bundles}
        columns={columns}
        query={query}
        onQueryChange={handleQueryChange}
        totalCount={bundles.length}
        isLoading={isLoading}
        emptyState={<BundlesTableEmpty />}
        showSearch={false}
        toolbarActions={toolbarActions}
      />
      <CreateBundleDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      {selectedBundle && (
        <EditBundleDialog
          bundle={selectedBundle}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          currentChildren={[]}
          currentPrimary={null}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// BundlesTable — exported composition.
//
// Must be rendered inside a DataTableQueryBoundary (the page does this) because
// BundlesTableInner calls useDataTableQuery which calls useSearchParams.
// ---------------------------------------------------------------------------

export function BundlesTable() {
  return <BundlesTableInner />;
}
