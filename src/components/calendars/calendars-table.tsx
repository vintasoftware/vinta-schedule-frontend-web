'use client';

import * as React from 'react';
import {
  Plus,
  Trash2,
  RotateCw,
  Cloud,
  EyeOff,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Switch } from 'vinta-schedule-design-system/ui/switch';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'vinta-schedule-design-system/ui/alert-dialog';
import { VStack, Text, HStack } from 'vinta-schedule-design-system/layout';
import type { Calendar } from '@/client';
import { useMyCalendars } from '@/hooks/calendars/use-my-calendars';
import { useDeleteCalendar } from '@/hooks/calendars/use-delete-calendar';
import { useRequestCalendarSync } from '@/hooks/calendars/use-request-calendar-sync';
import { useToggleCalendarSync } from '@/hooks/calendars/use-toggle-calendar-sync';
import { useToggleCalendarManageWindows } from '@/hooks/calendars/use-toggle-calendar-manage-windows';
import { useSetCalendarVisibility } from '@/hooks/calendars/use-set-calendar-visibility';
import { CreateCalendarDialog } from './create-calendar-dialog';
import { CalendarBookingRulesDialog } from '@/components/booking-policies/calendar-booking-rules-dialog';

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
// in-flight rows), onDelete, and onSync (row action handlers). This allows
// the table to pass its local pending-row state down into the column cell
// renderer.
// ---------------------------------------------------------------------------

export function createColumns(
  pendingRowIds: Set<number>,
  onDelete: (row: Calendar) => Promise<void>,
  onSync: (row: Calendar) => Promise<void>,
  onToggleSync: (row: Calendar, next: boolean) => Promise<void>,
  onToggleManageWindows: (row: Calendar, next: boolean) => Promise<void>,
  onToggleUnlisted: (row: Calendar) => Promise<void>,
  onEditRules: (row: Calendar) => void
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
      id: 'sync_enabled',
      header: 'Auto-sync',
      enableSorting: false,
      cell: ({ row }) => (
        <SyncToggle
          calendar={row.original}
          isLoading={pendingRowIds.has(row.original.id)}
          onToggleSync={onToggleSync}
        />
      ),
    },
    {
      id: 'manage_available_windows',
      header: 'Manage windows',
      enableSorting: false,
      cell: ({ row }) => (
        <ManageWindowsToggle
          calendar={row.original}
          isLoading={pendingRowIds.has(row.original.id)}
          onToggleManageWindows={onToggleManageWindows}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <HStack gap={2}>
          <BookingRulesButton
            calendar={row.original}
            isLoading={pendingRowIds.has(row.original.id)}
            onEditRules={onEditRules}
          />
          <SyncButton
            calendar={row.original}
            isLoading={pendingRowIds.has(row.original.id)}
            onSync={onSync}
          />
          <UnlistButton
            calendar={row.original}
            isLoading={pendingRowIds.has(row.original.id)}
            onToggleUnlisted={onToggleUnlisted}
          />
          <DeleteButton
            calendar={row.original}
            isLoading={pendingRowIds.has(row.original.id)}
            onDelete={onDelete}
          />
        </HStack>
      ),
    },
  ];
}

// Legacy export for backward compatibility (stories/tests that build columns statically).
export const COLUMNS = createColumns(
  new Set(),
  async () => {},
  async () => {},
  async () => {},
  async () => {},
  async () => {},
  () => {}
);

// ---------------------------------------------------------------------------
// SyncToggle — per-row switch to enable/disable external sync for a calendar.
// Disabling stops new CalendarSyncs (and their BlockedTimes) for calendars that
// aren't useful for scheduling.
// ---------------------------------------------------------------------------

interface SyncToggleProps {
  calendar: Calendar;
  isLoading: boolean;
  onToggleSync: (calendar: Calendar, next: boolean) => Promise<void>;
}

function SyncToggle({ calendar, isLoading, onToggleSync }: SyncToggleProps) {
  const enabled = calendar.sync_enabled ?? true;
  return (
    <Switch
      checked={enabled}
      disabled={isLoading}
      onCheckedChange={(next) => onToggleSync(calendar, next)}
      aria-label={`${enabled ? 'Disable' : 'Enable'} sync for ${calendar.name}`}
    />
  );
}

// ---------------------------------------------------------------------------
// ManageWindowsToggle — per-row switch to control whether a calendar manages
// its own available time windows. When off, it inherits the available windows
// of the external calendar it's attached to.
// ---------------------------------------------------------------------------

interface ManageWindowsToggleProps {
  calendar: Calendar;
  isLoading: boolean;
  onToggleManageWindows: (calendar: Calendar, next: boolean) => Promise<void>;
}

function ManageWindowsToggle({
  calendar,
  isLoading,
  onToggleManageWindows,
}: ManageWindowsToggleProps) {
  const enabled = calendar.manage_available_windows ?? false;
  return (
    <Switch
      checked={enabled}
      disabled={isLoading}
      onCheckedChange={(next) => onToggleManageWindows(calendar, next)}
      aria-label={`${enabled ? 'Disable' : 'Enable'} managing available windows for ${calendar.name}`}
    />
  );
}

// ---------------------------------------------------------------------------
// BookingRulesButton — per-row action to open the self-service booking-rules
// editor for a calendar the member owns (lead time, horizon, buffers).
// ---------------------------------------------------------------------------

interface BookingRulesButtonProps {
  calendar: Calendar;
  isLoading: boolean;
  onEditRules: (calendar: Calendar) => void;
}

function BookingRulesButton({
  calendar,
  isLoading,
  onEditRules,
}: BookingRulesButtonProps) {
  return (
    <Button
      size='sm'
      variant='outline'
      onClick={() => onEditRules(calendar)}
      disabled={isLoading}
      aria-label={`Edit booking rules for ${calendar.name}`}
    >
      <SlidersHorizontal aria-hidden />
      Booking rules
    </Button>
  );
}

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
          <Icon icon={RotateCw} spin />
          Syncing…
        </>
      ) : (
        <>
          <Cloud aria-hidden />
          Sync
        </>
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// UnlistButton — per-row toggle to hide a calendar from booking/listing
// queries (unlisted) or restore it to active visibility.
// ---------------------------------------------------------------------------

interface UnlistButtonProps {
  calendar: Calendar;
  isLoading: boolean;
  onToggleUnlisted: (calendar: Calendar) => Promise<void>;
}

function UnlistButton({
  calendar,
  isLoading,
  onToggleUnlisted,
}: UnlistButtonProps) {
  const isUnlisted = calendar.visibility === 'unlisted';
  return (
    <Button
      size='sm'
      variant='outline'
      onClick={() => onToggleUnlisted(calendar)}
      disabled={isLoading}
      aria-label={
        isUnlisted
          ? `Make calendar ${calendar.name} visible`
          : `Mark calendar ${calendar.name} as unlisted`
      }
    >
      {isUnlisted ? (
        <>
          <Eye aria-hidden />
          List
        </>
      ) : (
        <>
          <EyeOff aria-hidden />
          Unlist
        </>
      )}
    </Button>
  );
}

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
            <Icon icon={RotateCw} spin />
            Deleting…
          </>
        ) : (
          <>
            <Trash2 aria-hidden />
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
              <Text weight='medium'>{calendar.name}</Text>? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isLoading}
              // shadcn internal: AlertDialogAction hardcodes `buttonVariants()`
              // and exposes no `variant` prop, so the destructive surface can
              // only be set through className.
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
  const [rulesCalendar, setRulesCalendar] = React.useState<Calendar | null>(
    null
  );
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
  const { requestSync } = useRequestCalendarSync();
  const { toggleSync } = useToggleCalendarSync();
  const { toggleManageWindows } = useToggleCalendarManageWindows();
  const { setVisibility } = useSetCalendarVisibility();

  // Handle sync action: track in-flight row, call hook, show toast.
  // Fire-and-toast with no live tracking — the sync is async on the backend.
  const handleSync = React.useCallback(
    async (calendar: Calendar) => {
      // Mark this row as pending to disable its button.
      setPendingRowIds((prev) => new Set(prev).add(calendar.id));

      try {
        await requestSync(calendar.id);
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
    [requestSync]
  );

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

  // Handle visibility toggle: unlisted hides from booking/listing but keeps sync.
  // active restores full visibility.
  const handleToggleUnlisted = React.useCallback(
    async (calendar: Calendar) => {
      const next = calendar.visibility === 'unlisted' ? 'active' : 'unlisted';
      setPendingRowIds((prev) => new Set(prev).add(calendar.id));

      try {
        await setVisibility(calendar.id, next);
        toast.success(
          next === 'unlisted' ? 'Calendar unlisted' : 'Calendar listed',
          {
            description:
              next === 'unlisted'
                ? `${calendar.name} is now hidden from booking queries.`
                : `${calendar.name} is now visible for booking.`,
          }
        );
      } catch (err) {
        toast.error('Failed to update visibility', {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        });
      } finally {
        setPendingRowIds((prev) => {
          const next = new Set(prev);
          next.delete(calendar.id);
          return next;
        });
      }
    },
    [setVisibility]
  );

  // Handle sync-enabled toggle: track in-flight row, call hook, show toast.
  // The row reflects the new state after list invalidation.
  const handleToggleSync = React.useCallback(
    async (calendar: Calendar, next: boolean) => {
      setPendingRowIds((prev) => new Set(prev).add(calendar.id));

      try {
        await toggleSync(calendar.id, next);
        toast.success(next ? 'Sync enabled' : 'Sync disabled', {
          description: next
            ? `${calendar.name} will sync from its provider.`
            : `${calendar.name} will no longer sync.`,
        });
      } catch (err) {
        toast.error('Failed to update sync', {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        });
      } finally {
        setPendingRowIds((prev) => {
          const next = new Set(prev);
          next.delete(calendar.id);
          return next;
        });
      }
    },
    [toggleSync]
  );

  // Handle manage-available-windows toggle: track in-flight row, call hook,
  // show toast. The row reflects the new state after list invalidation.
  const handleToggleManageWindows = React.useCallback(
    async (calendar: Calendar, next: boolean) => {
      setPendingRowIds((prev) => new Set(prev).add(calendar.id));

      try {
        await toggleManageWindows(calendar.id, next);
        toast.success(
          next ? 'Managing own windows' : 'Inheriting external windows',
          {
            description: next
              ? `${calendar.name} now manages its own available windows.`
              : `${calendar.name} now uses its external calendar's windows.`,
          }
        );
      } catch (err) {
        toast.error('Failed to update availability windows', {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        });
      } finally {
        setPendingRowIds((prev) => {
          const next = new Set(prev);
          next.delete(calendar.id);
          return next;
        });
      }
    },
    [toggleManageWindows]
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
      <Plus aria-hidden />
      New calendar
    </Button>
  );

  const columns = createColumns(
    pendingRowIds,
    handleDelete,
    handleSync,
    handleToggleSync,
    handleToggleManageWindows,
    handleToggleUnlisted,
    setRulesCalendar
  );

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
      {rulesCalendar && (
        <CalendarBookingRulesDialog
          open={rulesCalendar !== null}
          onOpenChange={(open) => {
            if (!open) setRulesCalendar(null);
          }}
          calendarId={rulesCalendar.id}
          calendarName={rulesCalendar.name}
        />
      )}
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
