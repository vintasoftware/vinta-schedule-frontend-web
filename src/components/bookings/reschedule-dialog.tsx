'use client';

/**
 * RescheduleDialog — move an existing booking to a new date/time.
 *
 * Flow:
 *  1. Opens pre-filled with the event's current date, start time, end time,
 *     and timezone (all derived from the CalendarEventVM).
 *  2. On submit:
 *     a. Re-run useAvailabilityCheck on the NEW time (warn-but-allow-override).
 *     b. If conflict → show ConflictSurface; user can "Book anyway" or adjust.
 *     c. If recurring → ScopePromptDialog to choose scope; else skip.
 *     d. Call useRescheduleBooking with (event, newStart, newEnd, timezone, scope?).
 *  3. Validate: end must be after start; both required.
 *  4. Disable controls while any async op is pending.
 *  5. Toast on success/failure; close on success.
 *
 * Scope → operation mapping (handled by useRescheduleBooking):
 *   Non-recurring / scope='all' → PATCH (calendarEventsPartialUpdate)
 *   scope='this'                → POST create-exception with modified times
 *   scope='following'           → POST bulk-modify with time offsets
 *
 * Availability check:
 *   Only the event's own calendar is checked (from event.calendarId). If
 *   calendarId is unavailable, the check is skipped and the user proceeds
 *   directly. Co-booked blocked-times are moved by backend cascade.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { DateTime } from 'luxon';
import { toNaiveLocal } from '@/lib/datetime/index';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { VStack } from '@/components/layout';
import {
  ConflictSurface,
  type CalendarConflict,
} from '@/components/bookings/conflict-surface';
import { ScopePromptDialog } from '@/components/bookings/scope-prompt-dialog';
import type { RecurringScope } from '@/components/bookings/scope-prompt-dialog';
import { useAvailabilityCheck } from '@/hooks/bookings/use-availability-check';
import { useRescheduleBooking } from '@/hooks/bookings/use-reschedule-booking';
import type { CalendarEventVM } from '@/components/calendar/event-vm';
import type { AvailabilityResult } from '@/hooks/bookings/use-availability-check';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const rescheduleSchema = z
  .object({
    date: z.string().min(1, { message: 'Date is required' }),
    startTime: z.string().min(1, { message: 'Start time is required' }),
    endTime: z.string().min(1, { message: 'End time is required' }),
    timezone: z.string().min(1, { message: 'Timezone is required' }),
  })
  .refine(
    (data) => {
      if (!data.startTime || !data.endTime || !data.date) return true;
      const start = DateTime.fromISO(`${data.date}T${data.startTime}`);
      const end = DateTime.fromISO(`${data.date}T${data.endTime}`);
      return end > start;
    },
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  );

type RescheduleFormValues = z.infer<typeof rescheduleSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the date (YYYY-MM-DD) and time (HH:MM) components from a Luxon
 * DateTime in its own zone, for pre-filling the form.
 */
function splitDt(dt: DateTime): { date: string; time: string } {
  return {
    date: dt.toISODate() ?? '',
    time: dt.toFormat('HH:mm'),
  };
}

/**
 * Convert a CalendarConflict[] from availability results.
 * Uses calendarId for identification; calendarName falls back to "Calendar N".
 */
function toCalendarConflicts(
  results: AvailabilityResult[]
): CalendarConflict[] {
  return results
    .filter((r) => !r.isFree)
    .map((r) => ({
      calendarId: r.calendarId,
      calendarName: `Calendar ${r.calendarId}`,
      conflictingWindows: r.conflictingWindows,
      nearestFreeWindow: r.nearestFreeWindow,
    }));
}

// ---------------------------------------------------------------------------
// RescheduleDialog
// ---------------------------------------------------------------------------

export interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The event to reschedule. Null = dialog is closed. */
  event: CalendarEventVM | null;
}

export function RescheduleDialog({
  open,
  onOpenChange,
  event,
}: RescheduleDialogProps) {
  // ---- State ----------------------------------------------------------------

  const [isPending, setIsPending] = React.useState(false);
  const [conflicts, setConflicts] = React.useState<CalendarConflict[] | null>(
    null
  );
  const [scopeOpen, setScopeOpen] = React.useState(false);

  // Store resolved datetimes between availability check and the reschedule call
  // (used when user dismisses conflict then picks scope).
  // State (not ref) is used so that the values are captured in closures for
  // the conflict-override and scope-selection paths without triggering
  // React Compiler ref-during-render warnings.
  //
  // Two pairs of times:
  //   newStart/newEnd      — offset-bearing ISO (for availability-check query params)
  //   newStartLocal/newEndLocal — naive wall-clock (for the write payload)
  const [pendingReschedule, setPendingReschedule] = React.useState<{
    newStart: string;
    newEnd: string;
    newStartLocal: string;
    newEndLocal: string;
    timezone: string;
  } | null>(null);

  // ---- Hooks ----------------------------------------------------------------

  const { checkCalendar } = useAvailabilityCheck();
  const { rescheduleBooking } = useRescheduleBooking();

  // ---- Form -----------------------------------------------------------------

  // Build default values from the event's current times (zoned).
  const defaultValues = React.useMemo((): RescheduleFormValues => {
    if (!event) {
      return { date: '', startTime: '', endTime: '', timezone: 'UTC' };
    }
    const start = splitDt(event.startDt);
    const end = splitDt(event.endDt);
    return {
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      timezone: event.timezone,
    };
  }, [event]);

  const form = useForm<RescheduleFormValues>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues,
  });

  // Reset form + state when the dialog opens or a new event is loaded.
  React.useEffect(() => {
    if (open && event) {
      const start = splitDt(event.startDt);
      const end = splitDt(event.endDt);
      form.reset({
        date: start.date,
        startTime: start.time,
        endTime: end.time,
        timezone: event.timezone,
      });
      setConflicts(null);
      setIsPending(false);
      setPendingReschedule(null);
    }
  }, [open, event, form]);

  if (!event) return null;

  // ---- Build ISO datetimes from form values --------------------------------

  /**
   * Build datetimes from form values — returns both offset and naive forms.
   *
   * - `newStart`/`newEnd`: full ISO with UTC offset — used for the
   *   availability-check query params so the backend resolves exact instants.
   * - `newStartLocal`/`newEndLocal`: naive wall-clock "YYYY-MM-DDTHH:mm:ss"
   *   (no offset, no Z) — used in the write payload; timezone sent separately.
   */
  function buildDatetimes(values: RescheduleFormValues) {
    const startISO = `${values.date}T${values.startTime}:00`;
    const endISO = `${values.date}T${values.endTime}:00`;
    const startDt = DateTime.fromISO(startISO, { zone: values.timezone });
    const endDt = DateTime.fromISO(endISO, { zone: values.timezone });
    return {
      newStart: startDt.toISO()!,
      newEnd: endDt.toISO()!,
      newStartLocal: toNaiveLocal(startDt),
      newEndLocal: toNaiveLocal(endDt),
      timezone: values.timezone,
    };
  }

  // ---- doReschedule — final call after checks + scope resolved ------------

  /**
   * Execute the reschedule write. Receives NAIVE local times (no offset) for
   * the write payload; timezone is sent separately so the backend computes the
   * correct UTC moment.
   */
  const doReschedule = async (
    newStart: string,
    newEnd: string,
    timezone: string,
    scope?: RecurringScope
  ) => {
    setIsPending(true);
    try {
      await rescheduleBooking(event, newStart, newEnd, timezone, scope);
      toast.success('Event rescheduled', {
        description: `"${event.title}" has been moved to the new time.`,
      });
      setScopeOpen(false);
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to reschedule event', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsPending(false);
    }
  };

  // ---- onSubmit — availability check, then conflict or proceed ------------

  const onSubmit = async (values: RescheduleFormValues) => {
    setIsPending(true);
    setConflicts(null);

    const { newStart, newEnd, newStartLocal, newEndLocal, timezone } =
      buildDatetimes(values);
    setPendingReschedule({
      newStart,
      newEnd,
      newStartLocal,
      newEndLocal,
      timezone,
    });

    // Run availability check on the event's own calendar (if known).
    // Use the OFFSET form so the backend resolves exact instants for filtering.
    if (event.calendarId !== undefined) {
      const result = await checkCalendar({
        calendarId: event.calendarId,
        startDatetime: newStart,
        endDatetime: newEnd,
      });

      if (!result.isFree) {
        setConflicts(toCalendarConflicts([result]));
        setIsPending(false);
        return;
      }
    }

    // No conflicts — proceed using NAIVE local times for the write payload.
    setIsPending(false);
    proceedAfterCheck(newStartLocal, newEndLocal, timezone);
  };

  // ---- proceedAfterCheck — called when no conflict or on override ----------
  // Receives NAIVE local times (write payload form); stashes them in state so
  // handleScopeSelect can forward them to doReschedule after scope selection.

  const proceedAfterCheck = (
    newStartLocal: string,
    newEndLocal: string,
    timezone: string
  ) => {
    setPendingReschedule({
      newStart: newStartLocal,
      newEnd: newEndLocal,
      newStartLocal,
      newEndLocal,
      timezone,
    });
    if (event.isRecurring) {
      setScopeOpen(true);
    } else {
      void doReschedule(newStartLocal, newEndLocal, timezone);
    }
  };

  // ---- ConflictSurface callbacks ------------------------------------------

  const onProceed = () => {
    if (!pendingReschedule) return;
    setConflicts(null);
    // Pass NAIVE local times for the write payload (offset was used for the check).
    proceedAfterCheck(
      pendingReschedule.newStartLocal,
      pendingReschedule.newEndLocal,
      pendingReschedule.timezone
    );
  };

  const onAdjust = () => {
    setConflicts(null);
  };

  // ---- ScopePromptDialog callback -----------------------------------------

  const handleScopeSelect = async (scope: RecurringScope) => {
    if (!pendingReschedule) return;
    await doReschedule(
      pendingReschedule.newStart,
      pendingReschedule.newEnd,
      pendingReschedule.timezone,
      scope
    );
  };

  // ---- Render --------------------------------------------------------------

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Reschedule event</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            {conflicts ? (
              // Conflict surface overlays the form (warn-but-allow-override).
              <ConflictSurface
                conflicts={conflicts}
                onProceed={onProceed}
                onAdjust={onAdjust}
                isPending={isPending}
              />
            ) : (
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className='flex flex-col gap-4'
                data-testid='reschedule-form'
              >
                <VStack gap={4}>
                  {/* Date */}
                  <FormField
                    control={form.control}
                    name='date'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input
                            type='date'
                            {...field}
                            disabled={isPending}
                            data-testid='reschedule-date'
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Start time */}
                  <FormField
                    control={form.control}
                    name='startTime'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start time</FormLabel>
                        <FormControl>
                          <Input
                            type='time'
                            {...field}
                            disabled={isPending}
                            data-testid='reschedule-start-time'
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* End time */}
                  <FormField
                    control={form.control}
                    name='endTime'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End time</FormLabel>
                        <FormControl>
                          <Input
                            type='time'
                            {...field}
                            disabled={isPending}
                            data-testid='reschedule-end-time'
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Timezone (read-only display — inherits from event) */}
                  <FormField
                    control={form.control}
                    name='timezone'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timezone</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            disabled
                            data-testid='reschedule-timezone'
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </VStack>

                <DialogFooter>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => onOpenChange(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type='submit'
                    disabled={isPending}
                    data-testid='reschedule-submit'
                  >
                    {isPending ? 'Rescheduling…' : 'Reschedule'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </Form>
        </DialogContent>
      </Dialog>

      {/* Scope prompt — shown for recurring events after availability check */}
      <ScopePromptDialog
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        eventTitle={event.title}
        onSelect={handleScopeSelect}
        actionLabel='Reschedule'
      />
    </>
  );
}
