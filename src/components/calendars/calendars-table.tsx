'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VStack, Text } from '@/components/layout';
import type { Calendar } from '@/client';
import { useMyCalendars } from '@/hooks/calendars/use-my-calendars';
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
// Exported so stories and sibling modules can import them directly.
// ---------------------------------------------------------------------------

export const COLUMNS: DataTableColumn<Calendar>[] = [
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
];

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
  const { query, setPage } = useDataTableQuery();

  const handleQueryChange = React.useCallback(
    (next: typeof query) => {
      if (next.page !== query.page) setPage(next.page);
    },
    [query, setPage]
  );

  const { calendars, totalCount, isLoading, isError, error } =
    useMyCalendars(query);

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

  return (
    <>
      <DataTable<Calendar>
        data={calendars}
        columns={COLUMNS}
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
