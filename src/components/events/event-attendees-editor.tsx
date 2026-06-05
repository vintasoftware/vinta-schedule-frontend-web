'use client';

/**
 * EventAttendeesEditor — editor for all three attendee kinds on a calendar event.
 *
 * Sections:
 *  1. Internal attendees — add by user ID, remove by row.
 *     (OrganizationMembership does not expose the numeric user.id, so we accept
 *     a manual user-id input. The booking form follows the same pattern.)
 *  2. External attendees — add by email + optional name, remove by row.
 *  3. Resource allocations — pick a resource-type calendar by id, remove by row.
 *     Uses `useMyCalendars` filtered to `calendar_type === 'resource'`.
 *
 * Controlled state (not rhf) — the three arrays are stored in local state and
 * populated from the initial event data. On Save the current arrays are sent to
 * `updateAttendees` which does a full-replace PATCH.
 *
 * Disabled while the mutation is pending. Toast on success or error.
 */

import * as React from 'react';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VStack, HStack, Text } from '@/components/layout';
import { useMyCalendars } from '@/hooks/calendars/use-my-calendars';
import { useUpdateAttendees } from '@/hooks/events/use-update-attendees';
import type {
  EventAttendance,
  EventExternalAttendance,
  ResourceAllocation,
  EventAttendanceWritable,
  EventExternalAttendanceWritable,
  ResourceAllocationWritable,
} from '@/client';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EventAttendeesEditorProps {
  /** The numeric event id. */
  eventId: number;
  /** Current internal attendees from the API response. */
  initialAttendances: EventAttendance[];
  /** Current external attendees from the API response. */
  initialExternalAttendances: EventExternalAttendance[];
  /** Current resource allocations from the API response. */
  initialResourceAllocations: ResourceAllocation[];
  /** Called after a successful save so the parent can close/refresh. */
  onSaved?: () => void;
}

// ---------------------------------------------------------------------------
// Row types for local state
// ---------------------------------------------------------------------------

/** Internal attendee row — stores the writable shape plus a display label. */
interface InternalRow {
  /** Stable local key for list rendering. */
  key: string;
  user_id: number;
  /** Preserved id for update-semantics (the backend uses this to match rows). */
  id?: number | null;
}

/** External attendee row. */
interface ExternalRow {
  key: string;
  email: string;
  name: string;
  id?: number | null;
  externalAttendeeId?: number | null;
}

/** Resource allocation row. */
interface ResourceRow {
  key: string;
  calendarId: number;
  id?: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _rowId = 0;
function nextKey(): string {
  return String(++_rowId);
}

function mapToWritableAttendances(
  rows: InternalRow[]
): EventAttendanceWritable[] {
  return rows.map((r) => ({ id: r.id, user_id: r.user_id }));
}

function mapToWritableExternal(
  rows: ExternalRow[]
): EventExternalAttendanceWritable[] {
  return rows.map((r) => ({
    id: r.id,
    external_attendee: {
      id: r.externalAttendeeId,
      email: r.email,
      name: r.name || undefined,
    },
  }));
}

function mapToWritableResources(
  rows: ResourceRow[]
): ResourceAllocationWritable[] {
  return rows.map((r) => ({ id: r.id, calendar: r.calendarId }));
}

// ---------------------------------------------------------------------------
// EventAttendeesEditor
// ---------------------------------------------------------------------------

export function EventAttendeesEditor({
  eventId,
  initialAttendances,
  initialExternalAttendances,
  initialResourceAllocations,
  onSaved,
}: EventAttendeesEditorProps) {
  // ---- Local state ---------------------------------------------------------

  const [internalRows, setInternalRows] = React.useState<InternalRow[]>(() =>
    initialAttendances.map((a) => ({
      key: nextKey(),
      user_id: a.user.id,
      id: a.id,
    }))
  );

  const [externalRows, setExternalRows] = React.useState<ExternalRow[]>(() =>
    initialExternalAttendances.map((a) => ({
      key: nextKey(),
      email: a.external_attendee.email,
      name: a.external_attendee.name ?? '',
      id: a.id,
      externalAttendeeId: a.external_attendee.id,
    }))
  );

  const [resourceRows, setResourceRows] = React.useState<ResourceRow[]>(() =>
    initialResourceAllocations.map((r) => ({
      key: nextKey(),
      calendarId: r.calendar,
      id: r.id,
    }))
  );

  // ---- "New row" draft inputs ----------------------------------------------

  const [newInternalUserId, setNewInternalUserId] = React.useState('');
  const [newExternalEmail, setNewExternalEmail] = React.useState('');
  const [newExternalName, setNewExternalName] = React.useState('');
  const [newResourceCalendarId, setNewResourceCalendarId] = React.useState('');

  // ---- Data -----------------------------------------------------------------

  const { calendars: allCalendars, isLoading: calendarsLoading } =
    useMyCalendars({ page: 1, pageSize: 100, ordering: null, search: null });

  const resourceCalendars = React.useMemo(
    () =>
      allCalendars.filter((c) => c.calendar_type === 'resource' && c.is_active),
    [allCalendars]
  );

  const { updateAttendees, updateAttendeesMutation } = useUpdateAttendees();
  const isPending = updateAttendeesMutation.isPending;

  // ---- Internal attendees handlers -----------------------------------------

  const addInternal = () => {
    const uid = parseInt(newInternalUserId, 10);
    if (isNaN(uid) || uid <= 0) return;
    // Prevent duplicates.
    if (internalRows.some((r) => r.user_id === uid)) return;
    setInternalRows((prev) => [...prev, { key: nextKey(), user_id: uid }]);
    setNewInternalUserId('');
  };

  const removeInternal = (key: string) => {
    setInternalRows((prev) => prev.filter((r) => r.key !== key));
  };

  // ---- External attendees handlers -----------------------------------------

  const addExternal = () => {
    const email = newExternalEmail.trim();
    if (!email || !email.includes('@')) return;
    setExternalRows((prev) => [
      ...prev,
      { key: nextKey(), email, name: newExternalName.trim() },
    ]);
    setNewExternalEmail('');
    setNewExternalName('');
  };

  const removeExternal = (key: string) => {
    setExternalRows((prev) => prev.filter((r) => r.key !== key));
  };

  // ---- Resource allocation handlers ----------------------------------------

  const addResource = () => {
    const calId = parseInt(newResourceCalendarId, 10);
    if (isNaN(calId) || calId <= 0) return;
    if (resourceRows.some((r) => r.calendarId === calId)) return;
    setResourceRows((prev) => [...prev, { key: nextKey(), calendarId: calId }]);
    setNewResourceCalendarId('');
  };

  const removeResource = (key: string) => {
    setResourceRows((prev) => prev.filter((r) => r.key !== key));
  };

  // ---- Save ----------------------------------------------------------------

  const handleSave = async () => {
    try {
      await updateAttendees(eventId, {
        attendances: mapToWritableAttendances(internalRows),
        external_attendances: mapToWritableExternal(externalRows),
        resource_allocations: mapToWritableResources(resourceRows),
      });
      toast.success('Attendees updated');
      onSaved?.();
    } catch (err) {
      toast.error('Failed to update attendees', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  };

  // ---- Render --------------------------------------------------------------

  return (
    <VStack gap={6} data-slot='event-attendees-editor'>
      {/* ------------------------------------------------------------------ */}
      {/* Internal attendees                                                  */}
      {/* ------------------------------------------------------------------ */}
      <VStack gap={3}>
        <Text size='sm' className='font-semibold'>
          Internal attendees
        </Text>

        {internalRows.length === 0 && (
          <Text size='sm' color='muted-foreground'>
            No internal attendees.
          </Text>
        )}

        {internalRows.map((row) => (
          <HStack key={row.key} gap={2} align='center'>
            <Text size='sm' className='flex-1'>
              User ID: {row.user_id}
            </Text>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label={`Remove internal attendee with user ID ${row.user_id}`}
              onClick={() => removeInternal(row.key)}
              disabled={isPending}
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          </HStack>
        ))}

        {/* Add new internal attendee */}
        <HStack gap={2} align='center'>
          <Input
            type='number'
            placeholder='User ID'
            value={newInternalUserId}
            onChange={(e) => setNewInternalUserId(e.target.value)}
            disabled={isPending}
            className='flex-1'
            aria-label='Internal attendee user ID'
          />
          <Button
            type='button'
            variant='outline'
            size='icon'
            aria-label='Add internal attendee'
            onClick={addInternal}
            disabled={isPending || !newInternalUserId}
          >
            <Plus className='h-4 w-4' />
          </Button>
        </HStack>
      </VStack>

      {/* ------------------------------------------------------------------ */}
      {/* External attendees                                                  */}
      {/* ------------------------------------------------------------------ */}
      <VStack gap={3}>
        <Text size='sm' className='font-semibold'>
          External attendees
        </Text>

        {externalRows.length === 0 && (
          <Text size='sm' color='muted-foreground'>
            No external attendees.
          </Text>
        )}

        {externalRows.map((row) => (
          <HStack key={row.key} gap={2} align='center'>
            <VStack gap={0} className='flex-1'>
              <Text size='sm'>{row.email}</Text>
              {row.name && (
                <Text size='xs' color='muted-foreground'>
                  {row.name}
                </Text>
              )}
            </VStack>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label={`Remove external attendee ${row.email}`}
              onClick={() => removeExternal(row.key)}
              disabled={isPending}
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          </HStack>
        ))}

        {/* Add new external attendee */}
        <HStack gap={2} align='center'>
          <Input
            type='text'
            placeholder='Name (optional)'
            value={newExternalName}
            onChange={(e) => setNewExternalName(e.target.value)}
            disabled={isPending}
            className='flex-1'
            aria-label='External attendee name'
          />
          <Input
            type='email'
            placeholder='Email'
            value={newExternalEmail}
            onChange={(e) => setNewExternalEmail(e.target.value)}
            disabled={isPending}
            className='flex-1'
            aria-label='External attendee email'
          />
          <Button
            type='button'
            variant='outline'
            size='icon'
            aria-label='Add external attendee'
            onClick={addExternal}
            disabled={isPending || !newExternalEmail}
          >
            <Plus className='h-4 w-4' />
          </Button>
        </HStack>
      </VStack>

      {/* ------------------------------------------------------------------ */}
      {/* Resource allocations                                                */}
      {/* ------------------------------------------------------------------ */}
      <VStack gap={3}>
        <Text size='sm' className='font-semibold'>
          Resource calendars
        </Text>

        {resourceRows.length === 0 && (
          <Text size='sm' color='muted-foreground'>
            No resource calendars allocated.
          </Text>
        )}

        {resourceRows.map((row) => {
          const cal = allCalendars.find((c) => c.id === row.calendarId);
          return (
            <HStack key={row.key} gap={2} align='center'>
              <Text size='sm' className='flex-1'>
                {cal?.name ?? `Calendar ${row.calendarId}`}
              </Text>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label={`Remove resource ${cal?.name ?? row.calendarId}`}
                onClick={() => removeResource(row.key)}
                disabled={isPending}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </HStack>
          );
        })}

        {/* Add new resource allocation */}
        <HStack gap={2} align='center'>
          <Select
            value={newResourceCalendarId}
            onValueChange={setNewResourceCalendarId}
            disabled={isPending || calendarsLoading}
          >
            <SelectTrigger className='flex-1' aria-label='Resource calendar'>
              <SelectValue placeholder='Select resource calendar' />
            </SelectTrigger>
            <SelectContent>
              {resourceCalendars.map((cal) => (
                <SelectItem key={cal.id} value={String(cal.id)}>
                  {cal.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type='button'
            variant='outline'
            size='icon'
            aria-label='Add resource calendar'
            onClick={addResource}
            disabled={isPending || !newResourceCalendarId}
          >
            <Plus className='h-4 w-4' />
          </Button>
        </HStack>
      </VStack>

      {/* ------------------------------------------------------------------ */}
      {/* Save                                                                */}
      {/* ------------------------------------------------------------------ */}
      <HStack gap={2} justify='end'>
        <Button type='button' onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save attendees'}
        </Button>
      </HStack>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// EventAttendeesSheet — wraps the editor in a Sheet for the event detail surface.
// Includes a Cancel booking action (Phase 20).
// ---------------------------------------------------------------------------

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
import { ScopePromptDialog } from '@/components/bookings/scope-prompt-dialog';
import type { RecurringScope } from '@/components/bookings/scope-prompt-dialog';
import { useCancelBooking } from '@/hooks/bookings/use-cancel-booking';
import { RescheduleDialog } from '@/components/bookings/reschedule-dialog';
import { EditEventDialog } from '@/components/bookings/edit-event-dialog';
import type { CalendarEventVM } from '@/components/calendar/event-vm';
import { RoleGate } from '@/components/navigation/role-gate';
import { TransferEventDialog } from '@/components/events/transfer-event-dialog';

export interface EventAttendeesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEventVM | null;
}

/**
 * EventAttendeesSheet — event detail sheet with the attendees editor,
 * edit booking action, cancel booking action, and reschedule booking action.
 *
 * Edit flow:
 *  - Opens EditEventDialog pre-filled with the event's current fields.
 *  - EditEventDialog handles the scope prompt (for recurring events) internally.
 *
 * Cancel flow:
 *  - Non-recurring event: AlertDialog confirm → calendarEventsDestroy
 *  - Recurring event: ScopePromptDialog → cancel with the chosen scope
 *
 * Reschedule flow:
 *  - Opens RescheduleDialog with the event's current times pre-filled.
 *  - RescheduleDialog handles availability check, conflict surface, and
 *    scope prompt (for recurring events) internally.
 *
 * Opens when `event` is non-null. Populates the editor from `event._raw`
 * (the original API shape stored in the view-model).
 */
export function EventAttendeesSheet({
  open,
  onOpenChange,
  event,
}: EventAttendeesSheetProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [scopeOpen, setScopeOpen] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const { cancelBooking } = useCancelBooking();

  if (!event) return null;

  const raw = event._raw;

  const handleCancelClick = () => {
    if (event.isRecurring) {
      setScopeOpen(true);
    } else {
      setConfirmOpen(true);
    }
  };

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    try {
      await cancelBooking(event);
      toast.success('Event cancelled', {
        description: `"${event.title}" has been cancelled.`,
      });
      setConfirmOpen(false);
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to cancel event', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleScopeSelect = async (scope: RecurringScope) => {
    setIsCancelling(true);
    try {
      await cancelBooking(event, scope);
      toast.success('Event cancelled', {
        description: `"${event.title}" has been cancelled.`,
      });
      setScopeOpen(false);
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to cancel event', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side='right' className='overflow-y-auto sm:max-w-lg'>
          <SheetHeader>
            <SheetTitle>{event.title}</SheetTitle>
            <SheetDescription>
              {event.startDt.toFormat('ccc, d LLL yyyy · HH:mm')} (
              {event.timezoneLabel})
            </SheetDescription>
          </SheetHeader>

          <div className='mt-6'>
            <EventAttendeesEditor
              eventId={raw.id}
              initialAttendances={raw.attendances}
              initialExternalAttendances={raw.external_attendances}
              initialResourceAllocations={raw.resource_allocations}
              onSaved={() => onOpenChange(false)}
            />
          </div>

          {/* Actions: Edit + Reschedule + Cancel */}
          <div className='mt-6 space-y-2 border-t pt-4'>
            {/* Edit action */}
            <Button
              variant='outline'
              className='w-full'
              onClick={() => setEditOpen(true)}
              disabled={isCancelling}
              data-testid='edit-event-btn'
            >
              Edit event
            </Button>

            {/* Reschedule action */}
            <Button
              variant='outline'
              className='w-full'
              onClick={() => setRescheduleOpen(true)}
              disabled={isCancelling}
              data-testid='reschedule-event-btn'
            >
              Reschedule event
            </Button>

            {/* Cancel action */}
            <Button
              variant='outline'
              className='text-destructive border-destructive/30 hover:bg-destructive/10 w-full'
              onClick={handleCancelClick}
              disabled={isCancelling}
            >
              {isCancelling ? 'Cancelling…' : 'Cancel event'}
            </Button>

            {/* Transfer action (admin-only) */}
            <RoleGate role='admin'>
              <Button
                variant='outline'
                className='w-full'
                onClick={() => setTransferOpen(true)}
                disabled={isCancelling}
                data-testid='transfer-event-btn'
              >
                Transfer event
              </Button>
            </RoleGate>
          </div>
        </SheetContent>
      </Sheet>

      {/* Non-recurring: simple confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel{' '}
              <span className='font-medium'>{event.title}</span>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Keep event
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={isCancelling}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {isCancelling ? 'Cancelling…' : 'Cancel event'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recurring: scope-prompt dialog */}
      <ScopePromptDialog
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        eventTitle={event.title}
        onSelect={handleScopeSelect}
        actionLabel='Cancel'
      />

      {/* Edit dialog */}
      <EditEventDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        event={event}
      />

      {/* Reschedule dialog */}
      <RescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        event={event}
      />

      {/* Transfer dialog */}
      <TransferEventDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        eventId={raw.id}
        eventTitle={event.title}
        onTransferred={() => onOpenChange(false)}
      />
    </>
  );
}
