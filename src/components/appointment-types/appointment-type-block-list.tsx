'use client';

/**
 * AppointmentTypeBlockList — the appointment-type-scoped blocked-time rows for one calendar in
 * one slot (Phase 4). Unlike windows (a weekday grid, since roster patterns
 * are weekly), blocks are ad-hoc by nature -- a conference, one week off --
 * so there is no grid or diff here: every row is added, edited, and deleted
 * individually through AppointmentTypeBlockForm, mounted inside a Dialog this
 * component owns.
 *
 * Owns the alert state that appointment-type-window-grid.tsx owns for windows, but
 * simpler: there is no batched Promise.allSettled here (one form = one
 * write), so a save's outcome is exactly one of "succeeded, maybe with
 * orphans" or "rejected" (handled inline by AppointmentTypeBlockForm itself -- see
 * that file's doc comment for why over-limit renders there, not here).
 * Every create AND update runs orphan detection on the backend (not just
 * the first write, unlike windows), so this alert fires more often than the
 * grid's.
 *
 * Reuses OrphanedBookingsAlert (Phase 3c) unchanged -- `OrphanedBooking` is
 * structurally identical between `AppointmentTypeScopedAvailabilityOrphanedBooking`
 * and `AppointmentTypeScopedBlockOrphanedBooking`, see that component's doc comment.
 */

import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from 'vinta-schedule-design-system/ui/dialog';
import {
  HStack,
  Stack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';
import { zonedFormat } from '@/lib/datetime/index';
import { useAppointmentTypeScopedBlocks } from '@/hooks/appointment-types/use-appointment-type-scoped-blocks';
import { useCanEditCalendar } from './appointment-type-permissions-provider';
import { AppointmentTypeBlockForm } from './appointment-type-block-form';
import {
  OrphanedBookingsAlert,
  type OrphanedBooking,
} from './orphaned-bookings-alert';
import type { AppointmentTypeScopedBlockedTime } from '@/client';

import { handleMutationError } from '@/lib/utils/form-errors';

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface BlockRowProps {
  block: AppointmentTypeScopedBlockedTime;
  readOnly: boolean;
  isDeleting: boolean;
  onEdit: (block: AppointmentTypeScopedBlockedTime) => void;
  onDelete: (id: number) => void;
}

function BlockRow({
  block,
  readOnly,
  isDeleting,
  onEdit,
  onDelete,
}: BlockRowProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const handleDeleteClick = () => {
    if (block.is_recurring) {
      // The API deletes the whole series on a recurring row -- confirm
      // first so a single click can't remove more than the admin intended.
      setConfirmOpen(true);
      return;
    }
    onDelete(block.id);
  };

  const handleConfirm = () => {
    onDelete(block.id);
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
      data-testid={`appointment-type-block-${block.id}`}
    >
      <Stack gap={1}>
        <Text size='sm' weight='medium'>
          {zonedFormat(block.start_time, block.timezone)} –{' '}
          {zonedFormat(block.end_time, block.timezone, 'h:mm a')}
        </Text>
        <Text size='xs' color='muted-foreground'>
          {block.timezone} ·{' '}
          {block.is_recurring
            ? `Recurring (${block.rrule_string})`
            : 'One-time'}
        </Text>
        {block.reason && (
          <Text size='xs' color='muted-foreground'>
            Reason: {block.reason}
          </Text>
        )}
      </Stack>
      {!readOnly && (
        <HStack gap={1}>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={() => onEdit(block)}
            aria-label={`Edit block ${block.id}`}
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={handleDeleteClick}
            disabled={isDeleting}
            aria-label={`Delete block ${block.id}`}
          >
            <Trash2 aria-hidden />
          </Button>
        </HStack>
      )}

      {/* Only mounted when the delete control exists -- with readOnly there
          is no trigger that can ever open it. */}
      {!readOnly && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete recurring block</AlertDialogTitle>
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
                // can only be set through className (see unsupported-window-list.tsx).
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

export interface AppointmentTypeBlockListProps {
  appointmentTypeId: number;
  slotId: number;
  calendarId: number;
  /** Display name of `calendarId`'s calendar -- forwarded to OrphanedBookingsAlert. */
  calendarName?: string;
}

export function AppointmentTypeBlockList({
  appointmentTypeId,
  slotId,
  calendarId,
  calendarName,
}: AppointmentTypeBlockListProps) {
  // Read-only-ness comes from the shared AppointmentTypePermissionsProvider context
  // (mounted by the appointment type detail page) -- the same predicate every roster
  // row/editor in this feature consumes.
  const readOnly = !useCanEditCalendar(calendarId);

  const { blocks, isLoading, isTruncated, deleteBlock } =
    useAppointmentTypeScopedBlocks({
      appointmentTypeId,
      slotId,
      calendarId,
    });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingBlock, setEditingBlock] =
    React.useState<AppointmentTypeScopedBlockedTime | null>(null);
  const [orphanedBookings, setOrphanedBookings] = React.useState<
    OrphanedBooking[]
  >([]);
  const [pendingIds, setPendingIds] = React.useState<Set<number>>(new Set());

  const openCreate = () => {
    setEditingBlock(null);
    setDialogOpen(true);
  };
  const openEdit = (block: AppointmentTypeScopedBlockedTime) => {
    setEditingBlock(block);
    setDialogOpen(true);
  };

  const handleSaved = React.useCallback(
    (result: { orphanedBookings: OrphanedBooking[] }) => {
      setOrphanedBookings(result.orphanedBookings);
      setDialogOpen(false);
    },
    []
  );

  const handleDelete = React.useCallback(
    async (id: number) => {
      setPendingIds((prev) => new Set(prev).add(id));
      try {
        const result = await deleteBlock({
          appointmentTypeId,
          slotId,
          blockId: id,
        });
        if (result.status === 'row_gone') {
          toast.info('This entry no longer exists', {
            description: 'It may have already been removed.',
          });
        }
      } catch (err) {
        handleMutationError(err, { title: 'Failed to delete block' });
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [deleteBlock, appointmentTypeId, slotId]
  );

  if (isLoading) {
    return (
      <Stack gap={2} aria-label='Loading blocked time'>
        <Skeleton height={24} width='full' radius='md' />
      </Stack>
    );
  }

  return (
    <VStack gap={3} data-testid='appointment-type-block-list'>
      <HStack justify='between' align='center'>
        <Text size='sm' weight='medium' color='foreground'>
          Blocked time
        </Text>
        {!readOnly && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={openCreate}
          >
            Add block
          </Button>
        )}
      </HStack>

      {isTruncated && (
        <Text size='xs' color='warning'>
          This calendar has more blocked time in this slot than can be loaded at
          once -- some rows may not be shown below.
        </Text>
      )}

      {orphanedBookings.length > 0 && (
        <OrphanedBookingsAlert
          bookings={orphanedBookings}
          calendarName={calendarName}
          onDismiss={() => setOrphanedBookings([])}
        />
      )}

      {blocks.length === 0 ? (
        <Text size='sm' color='muted-foreground'>
          No blocked time configured.
        </Text>
      ) : (
        <Stack gap={2}>
          {blocks.map((block) => (
            <BlockRow
              key={block.id}
              block={block}
              readOnly={readOnly}
              isDeleting={pendingIds.has(block.id)}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </Stack>
      )}

      {!readOnly && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingBlock ? 'Edit blocked time' : 'Add blocked time'}
              </DialogTitle>
              <DialogDescription>
                Blocks apply only to this calendar in this slot -- base
                availability and every other appointment type are unaffected.
              </DialogDescription>
            </DialogHeader>
            {/* Conditionally mounted (not just visually hidden) so switching
                between "create" and editing block A vs block B always gives
                AppointmentTypeBlockForm a fresh mount -- see that file's doc comment
                on why this replaces a post-mount `form.reset`. */}
            {dialogOpen && (
              <AppointmentTypeBlockForm
                key={editingBlock?.id ?? 'create'}
                appointmentTypeId={appointmentTypeId}
                slotId={slotId}
                calendarId={calendarId}
                block={editingBlock ?? undefined}
                onSaved={handleSaved}
                onCancel={() => setDialogOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </VStack>
  );
}
