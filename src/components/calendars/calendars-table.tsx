'use client';

import * as React from 'react';
import { Plus, Trash2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { VStack, Text } from '@/components/layout';
import type { Calendar } from '@/client';
import { useMyCalendars } from '@/hooks/calendars/use-my-calendars';
import { useDeleteCalendar } from '@/hooks/calendars/use-delete-calendar';
import { CreateCalendarDialog } from './create-calendar-dialog';

// ---------------------------------------------------------------------------
// Badge variant maps for calendar properties
// ---------------------------------------------------------------------------

const CALENDAR_TYPE_VARIANT: Record<
  Calendar['calendar_type'],
  'default' | 'secondary' | 'info' | 'success' | 'warning' | 'danger' | 'teal'
> = {
  personal: 'default',
  resource: 'info',
  virtual: 'secondary',
  bundle: 'teal',
};

const PROVIDER_VARIANT: Record<
  Calendar['provider'],
  'default' | 'secondary' | 'info' | 'success' | 'warning' | 'danger' | 'teal'
> = {
  internal: 'default',
  google: 'secondary',
  microsoft: 'info',
  apple: 'secondary',
  ics: 'default',
};

function getStatusVariant(isActive: boolean): 'success' | 'danger' {
  return isActive ? 'success' : 'danger';
}

// ---------------------------------------------------------------------------
// Column definitions
// Helper to create columns — accepts pendingRowIds (to disable actions for
// in-flight rows) and onDelete (row action handler). This allows the table to
// pass its local pending-row state down into the column cell renderer.
// ---------------------------------------------------------------------------

export function createColumns(
  pendingRowIds: Set<number>,
  onDelete: (row: Calendar) => Promise<void>
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
      accessorKey: 'calendar_type',
      id: 'calendar_type',
      header: 'Type',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={CALENDAR_TYPE_VARIANT[row.original.calendar_type]}>
          {row.original.calendar_type}
        </Badge>
      ),
    },
    {
      accessorKey: 'provider',
      id: 'provider',
      header: 'Provider',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={PROVIDER_VARIANT[row.original.provider]}>
          {row.original.provider}
        </Badge>
      ),
    },
    {
      accessorKey: 'is_active',
      id: 'is_active',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.is_active)}>
          {row.original.is_active ? 'active' : 'disabled'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <DeleteButton
          calendar={row.original}
          isLoading={pendingRowIds.has(row.original.id)}
          onDelete={onDelete}
        />
      ),
    },
  ];
}

// Legacy export for backward compatibility (stories/tests that build columns statically).
export const COLUMNS = createColumns(new Set(), async () => {});

// ---------------------------------------------------------------------------
// DeleteButton — per-row action to delete a calendar with confirmation
// ---------------------------------------------------------------------------

interface DeleteButtonProps {
  calendar: Calendar;
  isLoading: boolean;
  onDelete: (calendar: Calendar) => Promise<void>;
}

function DeleteButton({ calendar, isLoading, onDelete }: DeleteButtonProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleConfirm = React.useCallback(async () => {
    await onDelete(calendar);
    setDialogOpen(false);
  }, [calendar, onDelete]);

  return (
    <>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setDialogOpen(true)}
        disabled={isLoading}
        aria-label={`Delete calendar ${calendar.name}`}
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
            <AlertDialogTitle>Delete calendar</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className='font-medium'>{calendar.name}</span>? This action
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
// CalendarsTableEmpty — custom empty state
// ---------------------------------------------------------------------------

function CalendarsTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No calendars found.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// CalendarsTableInner — renders inside the DataTableQueryBoundary.
// ---------------------------------------------------------------------------

function CalendarsTableInner() {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [pendingRowIds, setPendingRowIds] = React.useState<Set<number>>(
    new Set()
  );
  const { query, setPage } = useDataTableQuery();

  const handleQueryChange = React.useCallback(
    (next: typeof query) => {
      if (next.page !== query.page) setPage(next.page);
    },
    [query, setPage]
  );

  const { calendars, totalCount, isLoading, isError, error } =
    useMyCalendars(query);

  const { deleteCalendar } = useDeleteCalendar();

  // Handle delete action: track in-flight row, call hook, show toast.
  // The row is removed by invalidation after the mutation succeeds.
  const handleDelete = React.useCallback(
    async (calendar: Calendar) => {
      // Mark this row as pending to disable its button.
      setPendingRowIds((prev) => new Set(prev).add(calendar.id));

      try {
        await deleteCalendar(calendar.id);
        toast.success('Calendar deleted', {
          description: `${calendar.name} was deleted.`,
        });
      } catch (err) {
        toast.error('Failed to delete calendar', {
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
          next.delete(calendar.id);
          return next;
        });
      }
    },
    [deleteCalendar]
  );

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load calendars.
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
    <Button size='sm' onClick={() => setCreateOpen(true)}>
      <Plus className='size-4' aria-hidden />
      New calendar
    </Button>
  );

  const columns = createColumns(pendingRowIds, handleDelete);

  return (
    <>
      <DataTable<Calendar>
        data={calendars}
        columns={columns}
        query={query}
        onQueryChange={handleQueryChange}
        totalCount={totalCount}
        isLoading={isLoading}
        emptyState={<CalendarsTableEmpty />}
        showSearch={false}
        toolbarActions={toolbarActions}
      />
      <CreateCalendarDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

// ---------------------------------------------------------------------------
// CalendarsTable — exported composition.
//
// Must be rendered inside a DataTableQueryBoundary (the page does this).
// ---------------------------------------------------------------------------

export function CalendarsTable() {
  return <CalendarsTableInner />;
}
