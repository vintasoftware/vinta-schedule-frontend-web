'use client';

/**
 * UnsupportedWindowList — the read-only list of a calendar's appointment-type-scoped
 * availability windows the weekday grid (appointment-type-window-grid.tsx) cannot
 * express: one-offs, multi-day BYDAY, non-weekly recurrences, and anything
 * else `classifyWindows` (appointment-type-scoped-types.ts) marks unrepresentable.
 *
 * Never editable here -- only deletable, so configuration authored outside
 * the web app (spec UC-4) stays visible and named rather than vanishing
 * from the interface while still affecting bookings. Deleting a recurring
 * row confirms first: the API deletes the whole series, not one occurrence.
 *
 * Calls `useAppointmentTypeScopedWindows` with the same (appointmentTypeId, slotId, calendarId)
 * as AppointmentTypeWindowGrid -- TanStack Query dedupes the underlying fetch by
 * query key, so this is not a second network round trip. Both components
 * independently run the SAME `classifyWindows` over the SAME data, which is
 * what guarantees they can never disagree about which rows go where.
 */

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from 'vinta-schedule-design-system/ui/button';
import { Skeleton } from 'vinta-schedule-design-system/ui/skeleton';
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
import {
  HStack,
  Stack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';
import { zonedFormat } from '@/lib/datetime/index';
import { useAppointmentTypeScopedWindows } from '@/hooks/appointment-types/use-appointment-type-scoped-windows';
import { useCanEditCalendar } from './appointment-type-permissions-provider';
import { classifyWindows } from './appointment-type-scoped-types';
import type { AppointmentTypeScopedAvailabilityWindow } from '@/client';

import { handleMutationError } from '@/lib/utils/form-errors';

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface UnsupportedWindowRowProps {
  windowRow: AppointmentTypeScopedAvailabilityWindow;
  readOnly: boolean;
  isDeleting: boolean;
  onDelete: (id: number) => void;
}

function UnsupportedWindowRow({
  windowRow,
  readOnly,
  isDeleting,
  onDelete,
}: UnsupportedWindowRowProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const handleDeleteClick = () => {
    if (windowRow.is_recurring) {
      // The API deletes the whole series on a recurring row -- confirm
      // first so a single click can't remove more than the admin intended.
      setConfirmOpen(true);
      return;
    }
    onDelete(windowRow.id);
  };

  const handleConfirm = () => {
    onDelete(windowRow.id);
    setConfirmOpen(false);
  };

  return (
    <HStack
      gap={3}
      justify='between'
      align='start'
      p={3}
      border
      radius='md'
      data-testid={`unsupported-window-${windowRow.id}`}
    >
      <Stack gap={1}>
        <Text size='sm' weight='medium'>
          {zonedFormat(windowRow.start_time, windowRow.timezone)} –{' '}
          {zonedFormat(windowRow.end_time, windowRow.timezone, 'h:mm a')}
        </Text>
        <Text size='xs' color='muted-foreground'>
          {windowRow.timezone} ·{' '}
          {windowRow.is_recurring
            ? `Recurring (${windowRow.rrule_string})`
            : 'One-time'}
        </Text>
        <Text size='xs' color='muted-foreground'>
          This window can&apos;t be edited here — it doesn&apos;t fit the weekly
          grid above.
        </Text>
      </Stack>
      {!readOnly && (
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={handleDeleteClick}
          disabled={isDeleting}
          aria-label={`Delete window ${windowRow.id}`}
        >
          <Trash2 aria-hidden />
        </Button>
      )}

      {/* Only mounted when the delete control exists -- with readOnly there
          is no trigger that can ever open it. */}
      {!readOnly && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete recurring window</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the entire recurring series, not just one
                occurrence. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={isDeleting}
                // shadcn internal: AlertDialogAction hardcodes buttonVariants()
                // and exposes no `variant` prop, so the destructive surface
                // can only be set through className (see calendars-table.tsx).
                className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              >
                Delete series
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </HStack>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface UnsupportedWindowListProps {
  appointmentTypeId: number;
  slotId: number;
  calendarId: number;
}

export function UnsupportedWindowList({
  appointmentTypeId,
  slotId,
  calendarId,
}: UnsupportedWindowListProps) {
  // Read-only-ness comes from the shared AppointmentTypePermissionsProvider context
  // (mounted by the appointment type detail page) -- the same predicate AppointmentTypeWindowGrid
  // and every other roster row/editor in this feature consumes.
  const readOnly = !useCanEditCalendar(calendarId);

  const { windows, isLoading, isTruncated, deleteWindow } =
    useAppointmentTypeScopedWindows({ appointmentTypeId, slotId, calendarId });

  const { unrepresentable } = React.useMemo(
    () => classifyWindows(windows),
    [windows]
  );

  const [pendingIds, setPendingIds] = React.useState<Set<number>>(new Set());

  const handleDelete = React.useCallback(
    async (id: number) => {
      setPendingIds((prev) => new Set(prev).add(id));
      try {
        const result = await deleteWindow({
          appointmentTypeId,
          slotId,
          windowId: id,
        });
        if (result.status === 'row_gone') {
          toast.info('This entry no longer exists', {
            description: 'It may have already been removed.',
          });
        }
      } catch (err) {
        handleMutationError(err, { title: 'Failed to delete window' });
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [deleteWindow, appointmentTypeId, slotId]
  );

  if (isLoading) {
    return (
      <Stack gap={2} aria-label='Loading other windows'>
        <Skeleton height={24} width='full' radius='md' />
      </Stack>
    );
  }

  // Nothing the grid can't express -- no section to render.
  if (unrepresentable.length === 0) {
    return null;
  }

  return (
    <VStack gap={3} data-testid='unsupported-window-list'>
      <Text size='sm' weight='medium' color='foreground'>
        Other windows
      </Text>
      <Text size='xs' color='muted-foreground'>
        These windows don&apos;t fit the weekly grid above — one-time dates, or
        recurrence patterns the grid can&apos;t represent. They&apos;re listed
        here so nothing configured for this calendar is hidden.
      </Text>
      {isTruncated && (
        <Text size='xs' color='warning'>
          This calendar has more windows in this slot than can be loaded at once
          — some rows may be missing from this list.
        </Text>
      )}
      <Stack gap={2}>
        {unrepresentable.map((windowRow) => (
          <UnsupportedWindowRow
            key={windowRow.id}
            windowRow={windowRow}
            readOnly={readOnly}
            isDeleting={pendingIds.has(windowRow.id)}
            onDelete={handleDelete}
          />
        ))}
      </Stack>
    </VStack>
  );
}
