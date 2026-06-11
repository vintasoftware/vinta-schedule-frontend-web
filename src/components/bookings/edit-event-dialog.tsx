'use client';

/**
 * EditEventDialog — edit an event's title, description, and time.
 *
 * Flow:
 *  1. Opens pre-filled with the event's current title, description, date,
 *     start time, end time, and timezone (all derived from CalendarEventVM).
 *  2. On submit:
 *     a. If recurring → open ScopePromptDialog to choose scope.
 *        - "This event"         → editOccurrence(event, changes, 'this')
 *                                  (calendarEventsCreateExceptionCreate)
 *        - "This and following" → editOccurrence(event, changes, 'following')
 *                                  (calendarEventsBulkModifyCreate — Phase 23)
 *        - "All events"         → editOccurrence(event, changes, 'all')
 *                                  (calendarEventsPartialUpdate on series — Phase 24)
 *     b. If non-recurring → editOccurrence(event, changes) directly
 *        (calendarEventsPartialUpdate, no scope prompt).
 *  3. Validates: end must be after start; title required.
 *  4. Disables controls while pending; toast on success/failure.
 *  5. Closes on success.
 *
 * Scope → operation mapping (handled by useEditOccurrence):
 *   Non-recurring / scope='all' → PATCH (calendarEventsPartialUpdate)
 *   scope='this'                → POST create-exception with modified fields
 *   scope='following'           → POST bulk-modify with modified fields/offsets
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { DateTime } from 'luxon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { VStack } from '@/components/layout';
import { ScopePromptDialog } from '@/components/bookings/scope-prompt-dialog';
import type { RecurringScope } from '@/components/bookings/scope-prompt-dialog';
import { useEditOccurrence } from '@/hooks/bookings/use-edit-occurrence';
import type { CalendarEventVM } from '@/components/calendar/event-vm';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const editEventSchema = z
  .object({
    title: z.string().min(1, { message: 'Title is required' }),
    description: z.string(),
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

type EditEventFormValues = z.infer<typeof editEventSchema>;

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

// ---------------------------------------------------------------------------
// EditEventDialog
// ---------------------------------------------------------------------------

export interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The event to edit. Null = dialog is closed/inactive. */
  event: CalendarEventVM | null;
}

export function EditEventDialog({
  open,
  onOpenChange,
  event,
}: EditEventDialogProps) {
  // ---- State ----------------------------------------------------------------

  const [isPending, setIsPending] = React.useState(false);
  const [scopeOpen, setScopeOpen] = React.useState(false);

  // Store the form values between submit and scope-selection so the same
  // changes are used regardless of which scope is chosen.
  const [pendingChanges, setPendingChanges] =
    React.useState<EditEventFormValues | null>(null);

  // ---- Hooks ----------------------------------------------------------------

  const { editOccurrence } = useEditOccurrence();

  // ---- Form -----------------------------------------------------------------

  const defaultValues = React.useMemo((): EditEventFormValues => {
    if (!event) {
      return {
        title: '',
        description: '',
        date: '',
        startTime: '',
        endTime: '',
        timezone: 'UTC',
      };
    }
    const start = splitDt(event.startDt);
    const end = splitDt(event.endDt);
    return {
      title: event.title,
      description: event._raw.description ?? '',
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      timezone: event.timezone,
    };
  }, [event]);

  const form = useForm<EditEventFormValues>({
    resolver: zodResolver(editEventSchema),
    defaultValues,
  });

  // Reset form + state whenever the dialog opens or a new event is loaded.
  React.useEffect(() => {
    if (open && event) {
      const start = splitDt(event.startDt);
      const end = splitDt(event.endDt);
      form.reset({
        title: event.title,
        description: event._raw.description ?? '',
        date: start.date,
        startTime: start.time,
        endTime: end.time,
        timezone: event.timezone,
      });
      setIsPending(false);
      setPendingChanges(null);
    }
  }, [open, event, form]);

  if (!event) return null;

  // ---- Build EventChanges from form values ---------------------------------

  function buildChanges(values: EditEventFormValues) {
    const startISO = `${values.date}T${values.startTime}:00`;
    const endISO = `${values.date}T${values.endTime}:00`;
    const startDt = DateTime.fromISO(startISO, { zone: values.timezone });
    const endDt = DateTime.fromISO(endISO, { zone: values.timezone });

    return {
      title: values.title,
      description: values.description,
      startTime: startDt.toISO()!,
      endTime: endDt.toISO()!,
      timezone: values.timezone,
    };
  }

  // ---- doEdit — final call after scope resolved ---------------------------

  const doEdit = async (
    values: EditEventFormValues,
    scope?: RecurringScope
  ) => {
    setIsPending(true);
    try {
      const changes = buildChanges(values);
      await editOccurrence(event, changes, scope);
      toast.success('Event updated', {
        description: `"${values.title}" has been updated.`,
      });
      setScopeOpen(false);
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to update event', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsPending(false);
    }
  };

  // ---- onSubmit — branch on recurring vs non-recurring --------------------

  const onSubmit = (values: EditEventFormValues) => {
    if (event.isRecurring) {
      // Store values and open scope prompt.
      setPendingChanges(values);
      setScopeOpen(true);
    } else {
      // Non-recurring: edit directly (no scope prompt).
      void doEdit(values);
    }
  };

  // ---- ScopePromptDialog callback -----------------------------------------

  const handleScopeSelect = async (scope: RecurringScope) => {
    if (!pendingChanges) return;
    await doEdit(pendingChanges, scope);
  };

  // ---- Render --------------------------------------------------------------

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Edit event</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className='flex flex-col gap-4'
              data-testid='edit-event-form'
            >
              <VStack gap={4}>
                {/* Title */}
                <FormField
                  control={form.control}
                  name='title'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={isPending}
                          data-testid='edit-event-title'
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name='description'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          disabled={isPending}
                          data-testid='edit-event-description'
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          data-testid='edit-event-date'
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
                          data-testid='edit-event-start-time'
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
                          data-testid='edit-event-end-time'
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Timezone (read-only — inherits from event) */}
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
                          data-testid='edit-event-timezone'
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
                  data-testid='edit-event-submit'
                >
                  {isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Scope prompt — shown for recurring events after form submit */}
      <ScopePromptDialog
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        eventTitle={event.title}
        onSelect={handleScopeSelect}
        actionLabel='Edit'
      />
    </>
  );
}
