'use client';

/**
 * BookingForm — rhf + zod form for creating a single booking.
 *
 * Fields:
 *  - title (required)
 *  - date (required) — date-only string (YYYY-MM-DD)
 *  - startTime (required) — time string (HH:MM)
 *  - endTime (required) — time string (HH:MM), must be after startTime
 *  - timezone — IANA timezone, defaulting to the member's local zone
 *  - primaryCalendarId (required) — select from the member's calendars
 *  - coBookedCalendarIds — multi-select (checkboxes) from remaining calendars
 *  - internalAttendeeUserId (optional) — a single internal attendee user id
 *
 * Flow:
 *  1. On submit: run availability check for primary + co-booked calendars.
 *  2. If any conflict: render ConflictSurface (warn-but-allow-override).
 *  3. User clicks "Book anyway" → proceed with booking.
 *  4. On success: toast + close dialog.
 *  5. On backend rejection of override: surface error, no event created.
 *
 * The submit button is disabled (isPending) while any async operation is in
 * flight, preventing double-submit.
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { VStack, HStack, Text } from '@/components/layout';
import { useMyCalendars } from '@/hooks/calendars/use-my-calendars';
import { useAvailabilityCheck } from '@/hooks/bookings/use-availability-check';
import { useCreateBooking } from '@/hooks/bookings/use-create-booking';
import {
  ConflictSurface,
  type CalendarConflict,
} from '@/components/bookings/conflict-surface';
import type { AvailabilityResult } from '@/hooks/bookings/use-availability-check';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const bookingFormSchema = z
  .object({
    title: z.string().trim().min(1, { message: 'Title is required' }),
    date: z.string().min(1, { message: 'Date is required' }),
    startTime: z.string().min(1, { message: 'Start time is required' }),
    endTime: z.string().min(1, { message: 'End time is required' }),
    timezone: z.string().min(1, { message: 'Timezone is required' }),
    primaryCalendarId: z
      .string()
      .min(1, { message: 'Primary calendar is required' }),
    coBookedCalendarIds: z.array(z.number()),
    internalAttendeeUserId: z.string().optional(),
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

type BookingFormSchema = z.infer<typeof bookingFormSchema>;

// ---------------------------------------------------------------------------
// BookingFormDialog
// ---------------------------------------------------------------------------

interface BookingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookingFormDialog({
  open,
  onOpenChange,
}: BookingFormDialogProps) {
  // Fetch member's calendars for the pickers.
  const { calendars, isLoading: calendarsLoading } = useMyCalendars({
    page: 1,
    pageSize: 100,
    ordering: null,
    search: null,
  });

  const { checkCalendars } = useAvailabilityCheck();
  const { createBooking } = useCreateBooking();

  // Conflict state — null = no conflicts detected (or not checked yet).
  const [conflicts, setConflicts] = React.useState<CalendarConflict[] | null>(
    null
  );
  // Tracks whether an async operation is in flight.
  const [isPending, setIsPending] = React.useState(false);

  // Default timezone: the member's local IANA zone via Luxon.
  const localZone = React.useMemo(() => DateTime.local().zoneName ?? 'UTC', []);

  const form = useForm<BookingFormSchema>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      title: '',
      date: DateTime.local().toISODate() ?? '',
      startTime: '09:00',
      endTime: '10:00',
      timezone: localZone,
      primaryCalendarId: '',
      coBookedCalendarIds: [],
      internalAttendeeUserId: '',
    },
  });

  // Reset form + conflicts when the dialog opens/closes.
  React.useEffect(() => {
    if (!open) {
      form.reset({
        title: '',
        date: DateTime.local().toISODate() ?? '',
        startTime: '09:00',
        endTime: '10:00',
        timezone: localZone,
        primaryCalendarId: '',
        coBookedCalendarIds: [],
        internalAttendeeUserId: '',
      });
      setConflicts(null);
      setIsPending(false);
    }
  }, [open, form, localZone]);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Build ISO datetime strings for the API from form values. */
  function buildDatetimes(values: BookingFormSchema) {
    const startISO = `${values.date}T${values.startTime}:00`;
    const endISO = `${values.date}T${values.endTime}:00`;
    const startDt = DateTime.fromISO(startISO, { zone: values.timezone });
    const endDt = DateTime.fromISO(endISO, { zone: values.timezone });
    return {
      startDatetime: startDt.toISO()!,
      endDatetime: endDt.toISO()!,
    };
  }

  /** Convert availability results to CalendarConflict objects for the UI. */
  function toCalendarConflicts(
    results: AvailabilityResult[]
  ): CalendarConflict[] {
    return results
      .filter((r) => !r.isFree)
      .map((r) => {
        const cal = calendars.find((c) => c.id === r.calendarId);
        return {
          calendarId: r.calendarId,
          calendarName: cal?.name ?? `Calendar ${r.calendarId}`,
          conflictingWindows: r.conflictingWindows,
          nearestFreeWindow: r.nearestFreeWindow,
        };
      });
  }

  // -------------------------------------------------------------------------
  // onSubmit — check availability, then surface conflicts or proceed.
  // -------------------------------------------------------------------------

  const onSubmit = async (values: BookingFormSchema) => {
    setIsPending(true);
    setConflicts(null);

    const primaryId = parseInt(values.primaryCalendarId, 10);
    const allCalendarIds = [primaryId, ...values.coBookedCalendarIds];

    const { startDatetime, endDatetime } = buildDatetimes(values);

    // Run availability checks for all calendars.
    const results = await checkCalendars(
      allCalendarIds,
      startDatetime,
      endDatetime
    );

    const calendarConflicts = toCalendarConflicts(results);
    if (calendarConflicts.length > 0) {
      // Conflicts detected — surface the warn-but-allow-override UI.
      setConflicts(calendarConflicts);
      setIsPending(false);
      return;
    }

    // No conflicts — proceed with booking immediately.
    await proceedWithBooking(values, primaryId, startDatetime, endDatetime);
  };

  // -------------------------------------------------------------------------
  // proceedWithBooking — called after availability check passes or on override.
  // -------------------------------------------------------------------------

  const proceedWithBooking = async (
    values: BookingFormSchema,
    primaryId: number,
    startDatetime: string,
    endDatetime: string
  ) => {
    setIsPending(true);
    try {
      const attendances = values.internalAttendeeUserId
        ? [{ user_id: parseInt(values.internalAttendeeUserId, 10) }]
        : [];

      const result = await createBooking({
        event: {
          title: values.title,
          start_time: startDatetime,
          end_time: endDatetime,
          timezone: values.timezone,
          calendar: primaryId,
          external_attendances: [],
          attendances,
          resource_allocations: [],
        },
        coBookedCalendarIds: values.coBookedCalendarIds,
      });

      if (!result.allCoBookingsSucceeded) {
        const failedCalendars = result.blockedTimeResults
          .filter((r) => r.error !== undefined)
          .map((r) => {
            const cal = calendars.find((c) => c.id === r.calendarId);
            return cal?.name ?? `Calendar ${r.calendarId}`;
          })
          .join(', ');
        toast.warning('Booking created with partial co-booking failures', {
          description: `Event created, but blocked-times could not be added to: ${failedCalendars}. Please check those calendars manually.`,
        });
      } else {
        toast.success('Booking created', {
          description: `"${values.title}" has been scheduled.`,
        });
      }
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to create booking', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsPending(false);
    }
  };

  // -------------------------------------------------------------------------
  // onProceed — user clicked "Book anyway" after seeing conflicts.
  // -------------------------------------------------------------------------

  const onProceed = async () => {
    const values = form.getValues();
    const primaryId = parseInt(values.primaryCalendarId, 10);
    const { startDatetime, endDatetime } = buildDatetimes(values);
    setConflicts(null);
    await proceedWithBooking(values, primaryId, startDatetime, endDatetime);
  };

  // -------------------------------------------------------------------------
  // onAdjust — user chose to adjust the time (dismiss conflict surface).
  // -------------------------------------------------------------------------

  const onAdjust = () => {
    setConflicts(null);
  };

  // -------------------------------------------------------------------------
  // Calendar picker helpers
  // -------------------------------------------------------------------------

  const primaryCalendarId = form.watch('primaryCalendarId');
  const coBookedCalendarIds = form.watch('coBookedCalendarIds');

  // Calendars available for co-booking = all calendars except the primary one.
  const coBookableCalendars = React.useMemo(
    () =>
      calendars.filter(
        (cal) => String(cal.id) !== primaryCalendarId && cal.is_active
      ),
    [calendars, primaryCalendarId]
  );

  const handleCoBookToggle = (calendarId: number, checked: boolean) => {
    const current = form.getValues('coBookedCalendarIds');
    if (checked) {
      form.setValue('coBookedCalendarIds', [...current, calendarId]);
    } else {
      form.setValue(
        'coBookedCalendarIds',
        current.filter((id) => id !== calendarId)
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>New booking</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          {/* Conflict surface overlay — shown INSTEAD of the form when conflicts are detected.
              The Form/rhf provider stays mounted around both branches so portaled
              Select/Radix children don't lose context. */}
          {conflicts ? (
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
              noValidate
            >
              {/* Title */}
              <FormField
                control={form.control}
                name='title'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        type='text'
                        placeholder='Meeting title'
                        autoComplete='off'
                        {...field}
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
                      <Input type='date' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Start time / End time */}
              <HStack gap={3}>
                <FormField
                  control={form.control}
                  name='startTime'
                  render={({ field }) => (
                    <FormItem className='flex-1'>
                      <FormLabel>Start time</FormLabel>
                      <FormControl>
                        <Input type='time' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='endTime'
                  render={({ field }) => (
                    <FormItem className='flex-1'>
                      <FormLabel>End time</FormLabel>
                      <FormControl>
                        <Input type='time' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </HStack>

              {/* Timezone */}
              <FormField
                control={form.control}
                name='timezone'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <FormControl>
                      <Input
                        type='text'
                        placeholder='America/New_York'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Primary calendar */}
              <FormField
                control={form.control}
                name='primaryCalendarId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary calendar</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={calendarsLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select a calendar' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {calendars
                          .filter((c) => c.is_active)
                          .map((cal) => (
                            <SelectItem key={cal.id} value={String(cal.id)}>
                              {cal.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Co-booked calendars (multi-select via checkboxes) */}
              {primaryCalendarId && coBookableCalendars.length > 0 && (
                <VStack gap={2}>
                  <label className='text-sm leading-none font-medium'>
                    Also block on (co-booked)
                  </label>
                  <VStack gap={2}>
                    {coBookableCalendars.map((cal) => (
                      <HStack key={cal.id} gap={2} align='center'>
                        <Checkbox
                          id={`co-book-${cal.id}`}
                          checked={coBookedCalendarIds.includes(cal.id)}
                          onCheckedChange={(checked) =>
                            handleCoBookToggle(cal.id, Boolean(checked))
                          }
                        />
                        <label
                          htmlFor={`co-book-${cal.id}`}
                          className='cursor-pointer text-sm select-none'
                        >
                          {cal.name}
                        </label>
                      </HStack>
                    ))}
                  </VStack>
                </VStack>
              )}

              {/* Internal attendee (optional) */}
              <FormField
                control={form.control}
                name='internalAttendeeUserId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal attendee user ID (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='User ID'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <Text size='xs' color='muted-foreground'>
                      Leave blank to create a booking without internal
                      attendees.
                    </Text>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type='submit' disabled={isPending || calendarsLoading}>
                  {isPending ? 'Checking…' : 'Create booking'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </Form>
      </DialogContent>
    </Dialog>
  );
}
