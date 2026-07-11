'use client';

/**
 * BundlesTable — displays org bundles in a searchable, paginated datatable.
 *
 * Fetches bundles (calendars with calendar_type === 'bundle') via useAllCalendars,
 * filters client-side to show only bundle type, and displays them in a DataTable
 * with columns: Name, Actions (Edit, Delete).
 */

import * as React from 'react';
import { Plus, Pencil, Trash2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import type { Calendar } from '@/client';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableColumn } from '@/components/data-table/types';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import { useAllCalendars } from '@/hooks/calendars/use-all-calendars';
import { useDeleteBundle } from '@/hooks/bundles/use-delete-bundle';
import { VStack, Text, HStack } from '@vinta-schedule/design-system/layout';
import { Button } from '@vinta-schedule/design-system/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@vinta-schedule/design-system/ui/alert-dialog';
import { CreateBundleDialog } from './create-bundle-dialog';
import { EditBundleDialog } from './edit-bundle-dialog';

// ---------------------------------------------------------------------------
// Column definitions
// Helper to create columns — accepts pendingRowIds (to disable actions for
// in-flight rows), onEditClick, and onDelete (row action handlers).
// ---------------------------------------------------------------------------

function makeColumns(
  pendingRowIds: Set<number>,
  onEditClick: (bundle: Calendar) => void,
  onDelete: (bundle: Calendar) => Promise<void>
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
            disabled={pendingRowIds.has(row.original.id)}
            aria-label={`Edit ${row.original.name}`}
            data-testid={`edit-bundle-${row.original.id}`}
          >
            <Pencil className='h-4 w-4' />
          </Button>
          <DeleteButton
            bundle={row.original}
            isLoading={pendingRowIds.has(row.original.id)}
            onDelete={onDelete}
          />
        </HStack>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// DeleteButton — per-row action to delete a bundle with confirmation
// ---------------------------------------------------------------------------

interface DeleteButtonProps {
  bundle: Calendar;
  isLoading: boolean;
  onDelete: (bundle: Calendar) => Promise<void>;
}

function DeleteButton({ bundle, isLoading, onDelete }: DeleteButtonProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleConfirm = React.useCallback(async () => {
    await onDelete(bundle);
    setDialogOpen(false);
  }, [bundle, onDelete]);

  return (
    <>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setDialogOpen(true)}
        disabled={isLoading}
        aria-label={`Delete bundle ${bundle.name}`}
        data-testid={`delete-bundle-${bundle.id}`}
      >
        {isLoading ? (
          <>
            <RotateCw className='mr-1 size-4 animate-spin' aria-hidden />
            Deleting…
          </>
        ) : (
          <>
            <Trash2 className='mr-1 size-4' aria-hidden />
            Delete
          </>
        )}
      </Button>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bundle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className='font-medium'>{bundle.name}</span>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isLoading}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
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
  const [pendingRowIds, setPendingRowIds] = React.useState<Set<number>>(
    new Set()
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
  const { deleteBundle } = useDeleteBundle();

  // Filter to bundles only (calendar_type === 'bundle').
  const bundles = React.useMemo(
    () => calendars.filter((cal) => cal.calendar_type === 'bundle'),
    [calendars]
  );

  // Handle delete action: track in-flight row, call hook, show toast.
  // The row is removed by invalidation after the mutation succeeds.
  const handleDelete = React.useCallback(
    async (bundle: Calendar) => {
      // Mark this row as pending to disable its button.
      setPendingRowIds((prev) => new Set(prev).add(bundle.id));

      try {
        await deleteBundle(bundle.id);
        toast.success('Bundle deleted', {
          description: `${bundle.name} was deleted.`,
        });
      } catch (err) {
        toast.error('Failed to delete bundle', {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        });
      } finally {
        // Always clear the pending state, even on error.
        // Note: on success, the row is removed by invalidation, so this cleanup
        // is mainly for error cases.
        setPendingRowIds((prev) => {
          const next = new Set(prev);
          next.delete(bundle.id);
          return next;
        });
      }
    },
    [deleteBundle]
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

  const columns = makeColumns(pendingRowIds, handleEditClick, handleDelete);

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
