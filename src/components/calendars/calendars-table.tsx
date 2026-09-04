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
  Link2,
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
import { useOwnedCalendarIds } from '@/hooks/calendars/use-owned-calendar-ids';
import {
  usePermissions,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';
import { canMintBookingLinkForCalendar } from '@/lib/booking-links/can-mint-booking-link';
import { MintBookingLinkDialog } from '@/components/booking-links/mint-booking-link-dialog';
import { CreateCalendarDialog } from './create-calendar-dialog';
import { CalendarBookingRulesDialog } from '@/components/booking-policies/calendar-booking-rules-dialog';

import { getApiErrorMessage } from '@/lib/utils/api-errors';
import { handleMutationError } from '@/lib/utils/form-errors';
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

export interface CreateColumnsMintOptions {
  onMintLink: (row: Calendar) => void;
  canMintLink: (row: Calendar) => boolean;
}

export function createColumns(
  pendingRowIds: Set<number>,
  onDelete: (row: Calendar) => Promise<void>,
  onSync: (row: Calendar) => Promise<void>,
  onToggleSync: (row: Calendar, next: boolean) => Promise<void>,
  onToggleManageWindows: (row: Calendar, next: boolean) => Promise<void>,
  onToggleUnlisted: (row: Calendar) => Promise<void>,
  onEditRules: (row: Calendar) => void,
  // Optional and trailing so every pre-existing positional call (the legacy
  // COLUMNS export below, and calendars-table.stories.tsx) keeps compiling
  // and keeps rendering without a mint action, which is exactly the
  // "flag-off" behavior this additive phase relies on (see the plan's "No
  // feature flag" guiding decision). A single options object rather than two
  // more positional params — a caller that forgets one of two independent
  // trailing positional params silently loses the feature with no type
  // error; an omitted options object is comparatively harder to miss.
  mintOptions?: CreateColumnsMintOptions
): DataTableColumn<Calendar>[] {
  const onMintLink = mintOptions?.onMintLink ?? (() => {});
  const canMintLink = mintOptions?.canMintLink ?? (() => false);
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
          <MintLinkButton
            calendar={row.original}
            canMint={canMintLink(row.original)}
            onMintLink={onMintLink}
          />
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
// MintLinkButton — per-row action to open MintBookingLinkDialog for a
// calendar. Hidden entirely for a viewer canMintBookingLinkForCalendar would
// deny — a UI affordance only; the server re-checks the real owner-or-admin
// rule at mint time regardless (see can-mint-booking-link.ts).
// ---------------------------------------------------------------------------

interface MintLinkButtonProps {
  calendar: Calendar;
  canMint: boolean;
  onMintLink: (calendar: Calendar) => void;
}

function MintLinkButton({
  calendar,
  canMint,
  onMintLink,
}: MintLinkButtonProps) {
  if (!canMint) return null;

  return (
    <Button
      size='sm'
      variant='outline'
      onClick={() => onMintLink(calendar)}
      aria-label={`Get scheduling link for ${calendar.name}`}
    >
      <Link2 aria-hidden />
      Get link
    </Button>
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
  const [mintCalendar, setMintCalendar] = React.useState<Calendar | null>(null);
  const [pendingRowIds, setPendingRowIds] = React.useState<Set<number>>(
    new Set()
  );
  const { query, setPage } = useDataTableQuery();

  // There is no calendar detail page, so minting a link is a row action here
  // rather than a page-header action (contrast group-detail-view.tsx, which
  // has a detail page to hang it on). A null (unresolved) permissions set
  // fails closed via canMintBookingLinkForCalendar itself, so no separate
  // "loading" gate is needed here.
  const permissions = usePermissions();
  // The table is already fed by useMyCalendars above (`owner: 'me'`-scoped),
  // so fetching owned ids too is only needed to gate the mint action for a
  // non-admin — an admin's mint access doesn't depend on ownership. Matches
  // the sibling call sites (groups-table.tsx, groups/[id]/page.tsx), which
  // also skip this fetch for an admin viewer.
  const isAdmin = permissions?.includes(PERMISSIONS.manageMembers) ?? false;
  const { ownedCalendarIds } = useOwnedCalendarIds({ enabled: !isAdmin });
  const canMintLink = React.useCallback(
    (calendar: Calendar) =>
      canMintBookingLinkForCalendar({
        permissions,
        ownedCalendarIds,
        calendarId: calendar.id,
      }),
    [permissions, ownedCalendarIds]
  );

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
        handleMutationError(err, { title: 'Failed to start sync' });
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
        handleMutationError(err, { title: 'Failed to delete calendar' });
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
        handleMutationError(err, { title: 'Failed to update visibility' });
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
        handleMutationError(err, { title: 'Failed to update sync' });
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
        handleMutationError(err, {
          title: 'Failed to update availability windows',
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
          {getApiErrorMessage(error, 'An unexpected error occurred.')}
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
    setRulesCalendar,
    { onMintLink: setMintCalendar, canMintLink }
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
      {mintCalendar && (
        <MintBookingLinkDialog
          open={mintCalendar !== null}
          onOpenChange={(open) => {
            if (!open) setMintCalendar(null);
          }}
          target={{
            kind: 'calendar',
            id: mintCalendar.id,
            name: mintCalendar.name,
          }}
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
