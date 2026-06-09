'use client';

import * as React from 'react';
import { Cloud, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VStack, Text, HStack } from '@/components/layout';
import type { Calendar } from '@/client';
import { useAllCalendars } from '@/hooks/calendars/use-all-calendars';
import { useTriggerUserCalendarSync } from '@/hooks/sync/use-trigger-user-calendar-sync';

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

function getStatusVariant(
  visibility: Calendar['visibility']
): 'success' | 'warning' | 'danger' {
  if (visibility === 'unlisted') return 'warning';
  if (visibility === 'inactive') return 'danger';
  return 'success';
}

// ---------------------------------------------------------------------------
// Column definitions
// Helper to create columns — accepts pendingRowIds (to disable actions for
// in-flight rows) and onSync (row action handler). This allows the table to
// pass its local pending-row state down into the column cell renderer.
// ---------------------------------------------------------------------------

export function createColumns(
  pendingRowIds: Set<number>,
  onSync: (row: Calendar) => Promise<void>
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
      accessorKey: 'visibility',
      id: 'visibility',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.visibility)}>
          {row.original.visibility ?? 'active'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <HStack gap={2}>
          <SyncButton
            calendar={row.original}
            isLoading={pendingRowIds.has(row.original.id)}
            onSync={onSync}
          />
        </HStack>
      ),
    },
  ];
}

// Legacy export for backward compatibility (stories/tests that build columns statically).
export const COLUMNS = createColumns(new Set(), async () => {});

// ---------------------------------------------------------------------------
// SyncButton — per-row action to request a calendar sync (fire-and-toast)
// ---------------------------------------------------------------------------

interface SyncButtonProps {
  calendar: Calendar;
  isLoading: boolean;
  onSync: (calendar: Calendar) => Promise<void>;
}

function SyncButton({ calendar, isLoading, onSync }: SyncButtonProps) {
  return (
    <Button
      size='sm'
      variant='outline'
      onClick={() => onSync(calendar)}
      disabled={isLoading}
      aria-label={`Sync calendar ${calendar.name}`}
    >
      {isLoading ? (
        <>
          <RotateCw className='mr-1 size-4 animate-spin' aria-hidden />
          Syncing…
        </>
      ) : (
        <>
          <Cloud className='mr-1 size-4' aria-hidden />
          Sync
        </>
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// AllCalendarsTableEmpty — custom empty state
// ---------------------------------------------------------------------------

function AllCalendarsTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No calendars found.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// AllCalendarsTableInner — renders inside the DataTableQueryBoundary.
// ---------------------------------------------------------------------------

function AllCalendarsTableInner() {
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
    useAllCalendars(query);

  const { triggerUserCalendarSync } = useTriggerUserCalendarSync();

  // Handle sync action: track in-flight row, call hook, show toast.
  // Fire-and-toast with no live tracking — the sync is async on the backend.
  // Admin-only: calls calendarAdminSyncCreate to sync another user's calendar.
  const handleSync = React.useCallback(
    async (calendar: Calendar) => {
      // Mark this row as pending to disable its button.
      setPendingRowIds((prev) => new Set(prev).add(calendar.id));

      try {
        await triggerUserCalendarSync(calendar.id);
        toast.success('Sync started', {
          description: `${calendar.name} sync is in progress.`,
        });
      } catch (err) {
        toast.error('Failed to start sync', {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        });
      } finally {
        // Always clear the pending state, even on error.
        setPendingRowIds((prev) => {
          const next = new Set(prev);
          next.delete(calendar.id);
          return next;
        });
      }
    },
    [triggerUserCalendarSync]
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

  const columns = createColumns(pendingRowIds, handleSync);

  return (
    <DataTable<Calendar>
      data={calendars}
      columns={columns}
      query={query}
      onQueryChange={handleQueryChange}
      totalCount={totalCount}
      isLoading={isLoading}
      emptyState={<AllCalendarsTableEmpty />}
      showSearch={false}
    />
  );
}

// ---------------------------------------------------------------------------
// AllCalendarsTable — exported composition.
//
// Must be rendered inside a DataTableQueryBoundary (the page does this).
// ---------------------------------------------------------------------------

export function AllCalendarsTable() {
  return <AllCalendarsTableInner />;
}
