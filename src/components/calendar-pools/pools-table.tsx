'use client';

/**
 * PoolsTable — the organization's calendar pools, with edit and delete actions.
 *
 * Delete is refused with a 409 while the pool is still attached to a group
 * slot. That rejection names the groups holding it, and the confirmation dialog
 * keeps them on screen rather than toasting them away, because detaching the
 * pool from those groups is the exact next step the user has to take.
 *
 * Must be rendered inside a DataTableQueryBoundary (the page provides it)
 * because it calls useDataTableQuery → useSearchParams.
 */

import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Spinner } from 'vinta-schedule-design-system/ui/spinner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'vinta-schedule-design-system/ui/alert-dialog';
import { HStack, VStack, Text } from 'vinta-schedule-design-system/layout';
import {
  useCalendarPools,
  useDeleteCalendarPool,
  readPoolInUseError,
  type CalendarPool,
} from '@/hooks/calendar-pools/use-calendar-pools';
import { PoolDialog } from './pool-dialog';

import { getApiErrorMessage } from '@/lib/utils/api-errors';
import { handleMutationError } from '@/lib/utils/form-errors';

/** How many roster names a row shows before collapsing the rest into a count. */
const ROSTER_PREVIEW_LIMIT = 3;

function rosterPreview(pool: CalendarPool): string {
  const names = pool.calendars.map((c) => c.name);
  if (names.length <= ROSTER_PREVIEW_LIMIT) {
    return names.join(', ');
  }
  const shown = names.slice(0, ROSTER_PREVIEW_LIMIT).join(', ');
  return `${shown} +${names.length - ROSTER_PREVIEW_LIMIT} more`;
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

function createColumns(
  pendingRowIds: Set<number>,
  onEdit: (pool: CalendarPool) => void,
  onRequestDelete: (pool: CalendarPool) => void
): DataTableColumn<CalendarPool>[] {
  return [
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
      id: 'calendars',
      header: 'Calendars',
      enableSorting: false,
      cell: ({ row }) => (
        <HStack gap={2} align='center'>
          <Badge variant='secondary'>{row.original.calendars.length}</Badge>
          <Text color='muted-foreground' size='sm'>
            {rosterPreview(row.original) || '—'}
          </Text>
        </HStack>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          pool={row.original}
          isLoading={pendingRowIds.has(row.original.id)}
          onEdit={onEdit}
          onRequestDelete={onRequestDelete}
        />
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// RowActions
// ---------------------------------------------------------------------------

interface RowActionsProps {
  pool: CalendarPool;
  isLoading: boolean;
  onEdit: (pool: CalendarPool) => void;
  onRequestDelete: (pool: CalendarPool) => void;
}

/**
 * One row's actions. Deliberately stateless: the columns array is rebuilt on
 * every render, which remounts these cells and would drop any local state — so
 * the delete confirmation lives in PoolsTable, above the table, instead.
 */
function RowActions({
  pool,
  isLoading,
  onEdit,
  onRequestDelete,
}: RowActionsProps) {
  return (
    <HStack gap={2}>
      <Button
        size='sm'
        variant='outline'
        onClick={() => onEdit(pool)}
        disabled={isLoading}
        aria-label={`Edit pool ${pool.name}`}
      >
        <Pencil aria-hidden />
        Edit
      </Button>

      <Button
        size='sm'
        variant='outline'
        onClick={() => onRequestDelete(pool)}
        disabled={isLoading}
        aria-label={`Delete pool ${pool.name}`}
      >
        {isLoading ? (
          <>
            <Spinner label='' />
            Deleting…
          </>
        ) : (
          <>
            <Trash2 aria-hidden />
            Delete
          </>
        )}
      </Button>
    </HStack>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function PoolsTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No calendar pools yet. Create one to share a roster across the slots of
        several calendar groups.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// PoolsTable
// ---------------------------------------------------------------------------

export interface PoolsTableProps {
  /** Extra toolbar content (e.g. the "New pool" button). */
  toolbarActions?: React.ReactNode;
}

export function PoolsTable({ toolbarActions }: PoolsTableProps) {
  const [pendingRowIds, setPendingRowIds] = React.useState<Set<number>>(
    new Set()
  );
  const [editing, setEditing] = React.useState<CalendarPool | null>(null);
  const [confirmingDelete, setConfirmingDelete] =
    React.useState<CalendarPool | null>(null);
  // Set once the API refuses the delete, and holds the groups still attached to
  // the pool. Kept on screen inside the dialog rather than toasted, because
  // detaching the pool from those groups is the user's next step.
  const [blockingGroups, setBlockingGroups] = React.useState<string[] | null>(
    null
  );
  const { query, setPage, setSearch } = useDataTableQuery();

  const handleQueryChange = React.useCallback(
    (next: typeof query) => {
      if (next.search !== query.search) setSearch(next.search);
      if (next.page !== query.page) setPage(next.page);
    },
    [query, setPage, setSearch]
  );

  const { pools, totalCount, isLoading, isError, error } = useCalendarPools({
    query,
  });
  const { deleteCalendarPool } = useDeleteCalendarPool();

  const handleRequestDelete = React.useCallback((pool: CalendarPool) => {
    setBlockingGroups(null);
    setConfirmingDelete(pool);
  }, []);

  const handleConfirmDelete = React.useCallback(async () => {
    const pool = confirmingDelete;
    if (pool === null) return;

    setPendingRowIds((prev) => new Set(prev).add(pool.id));
    try {
      await deleteCalendarPool(pool.id);
      toast.success('Calendar pool deleted');
      setConfirmingDelete(null);
    } catch (err) {
      const inUse = readPoolInUseError(err);
      if (inUse) {
        setBlockingGroups(inUse.groups);
      } else {
        handleMutationError(err, { title: 'Failed to delete calendar pool' });
        setConfirmingDelete(null);
      }
    } finally {
      setPendingRowIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(pool.id);
        return nextSet;
      });
    }
  }, [confirmingDelete, deleteCalendarPool]);

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load calendar pools.
        </Text>
        <Text color='muted-foreground' size='sm'>
          {getApiErrorMessage(error, 'An unexpected error occurred.')}
        </Text>
      </VStack>
    );
  }

  const columns = createColumns(pendingRowIds, setEditing, handleRequestDelete);

  return (
    <>
      <DataTable<CalendarPool>
        data={pools}
        columns={columns}
        query={query}
        onQueryChange={handleQueryChange}
        totalCount={totalCount}
        isLoading={isLoading}
        emptyState={<PoolsTableEmpty />}
        toolbarActions={toolbarActions}
      />
      <PoolDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        pool={editing}
      />
      <AlertDialog
        open={confirmingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingDelete(null);
            setBlockingGroups(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete calendar pool</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <Text weight='medium'>{confirmingDelete?.name}</Text>? Groups
              using it must have it detached first.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {blockingGroups !== null ? (
            <VStack gap={1} data-testid='pool-delete-blocked'>
              <Text size='sm' color='destructive' weight='medium'>
                Still attached to{' '}
                {blockingGroups.length === 1 ? 'a group' : 'groups'}
              </Text>
              <Text size='sm' color='muted-foreground'>
                Detach it from {blockingGroups.join(', ')} before deleting.
              </Text>
            </VStack>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {/* A plain Button, not AlertDialogAction: Radix's action always
                closes the dialog, and a refused delete has to keep it open to
                show which groups are still holding the pool. */}
            <Button
              onClick={handleConfirmDelete}
              disabled={
                (confirmingDelete !== null &&
                  pendingRowIds.has(confirmingDelete.id)) ||
                blockingGroups !== null
              }
              variant='destructive'
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
