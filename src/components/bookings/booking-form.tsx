'use client';

/**
 * BookingForm — rhf + zod form for creating a single or recurring booking.
 *
 * Fields:
 *  - title (required)
 *  - date (required) — date-only string (YYYY-MM-DD)
 *  - startTime (required) — time string (HH:MM)
 *  - endTime (required) — time string (HH:MM), must be after startTime
 *  - timezone — IANA timezone, defaulting to the member's local zone
 *  - primaryCalendarId (required) — select from the member's calendars
 *  - coBookedCalendarIds — multi-select (checkboxes) from remaining calendars
 *  - attendances — list of internal attendee user IDs
 *  - externalAttendances — list of external attendees (email required, name optional)
 *  - repeat (bool) — enables the recurrence sub-form
 *  - recurrence sub-form: freq, interval, endType (never/on-date/after-n), until, count, byday
 *
 * Flow:
 *  1. On submit: run availability check for the first occurrence (start/end of
 *     the first event). Recurring bookings check the same first occurrence only
 *     (documented below).
 *  2. If any conflict: render ConflictSurface (warn-but-allow-override).
 *  3. User clicks "Book anyway" → proceed with booking.
 *  4. On success: toast + close dialog.
 *  5. On backend rejection of override: surface error, no event created.
 *
 * Recurrence strategy:
 *  - We send `rrule_string` (via serializeRRule from Phase 0c) to
 *    CalendarEventWritable. The backend accepts this as an RFC-5545 string and
 *    maps it into its RecurrenceRule model. We do NOT send `recurrence_rule`
 *    (the structured object) alongside to avoid duplication.
 *  - Conflict check covers only the first occurrence (same startDatetime /
 *    endDatetime as non-recurring). This is intentional: checking all
 *    occurrences of an unbounded series is impractical. The backend handles
 *    per-occurrence conflict enforcement. This is documented in ConflictSurface.
 *
 * The submit button is disabled (isPending) while any async operation is in
 * flight, preventing double-submit.
 */

import * as React from 'react';
import { useForm, useFieldArray, type UseFormReturn } from 'react-hook-form';
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
} from 'vinta-schedule-design-system/ui/dialog';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Checkbox } from 'vinta-schedule-design-system/ui/checkbox';
import { Switch } from 'vinta-schedule-design-system/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'vinta-schedule-design-system/ui/select';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from 'vinta-schedule-design-system/ui/form';
import { Label } from 'vinta-schedule-design-system/ui/label';
import {
  Box,
  FormLayout,
  VStack,
  HStack,
  Text,
} from 'vinta-schedule-design-system/layout';
import { useMyCalendars } from '@/hooks/calendars/use-my-calendars';
import { useResourceCalendars } from '@/hooks/calendars/use-resource-calendars';
import { useAvailabilityCheck } from '@/hooks/bookings/use-availability-check';
import { useCreateBooking } from '@/hooks/bookings/use-create-booking';
import {
  ConflictSurface,
  type CalendarConflict,
} from '@/components/bookings/conflict-surface';
import type { AvailabilityResult } from '@/hooks/bookings/use-availability-check';
import {
  serializeRRule,
  toNaiveLocal,
  weekdayMatrix,
  type RecurrenceRule,
} from '@/lib/datetime/index';
import { Combobox } from 'vinta-schedule-design-system/ui/combobox';
import { useOrgMemberSearch } from '@/hooks/team/use-org-member-search';

// ---------------------------------------------------------------------------
// Recurrence end-type discriminant
// ---------------------------------------------------------------------------

type RecurrenceEndType = 'never' | 'on-date' | 'after-n';

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
    resourceCalendarIds: z.array(z.number()),
    attendances: z.array(
      z.object({
        user_id: z.number().int().positive(),
        name: z.string(),
        email: z.string(),
      })
    ),
    externalAttendances: z.array(
      z.object({
        name: z.string().optional(),
        email: z.string().email('Valid email required'),
      })
    ),
    // Recurrence fields
    repeat: z.boolean(),
    recurrenceFreq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    recurrenceInterval: z
      .number()
      .int()
      .min(1, { message: 'Interval must be at least 1' }),
    recurrenceEndType: z.enum(['never', 'on-date', 'after-n']),
    recurrenceUntil: z.string().optional(),
    recurrenceCount: z
      .number()
      .int()
      .min(1, { message: 'Must be at least 1' })
      .optional(),
    // byday: comma-separated booleans stored as array of day codes
    recurrenceByday: z.array(z.string()),
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
  )
  .refine(
    (data) => {
      if (!data.repeat) return true;
      if (data.recurrenceEndType === 'on-date') {
        return (
          typeof data.recurrenceUntil === 'string' &&
          data.recurrenceUntil.trim().length > 0
        );
      }
      return true;
    },
    {
      message: 'End date is required when "On date" is selected',
      path: ['recurrenceUntil'],
    }
  )
  .refine(
    (data) => {
      if (!data.repeat) return true;
      if (data.recurrenceEndType === 'after-n') {
        return data.recurrenceCount !== undefined && data.recurrenceCount >= 1;
      }
      return true;
    },
    {
      message: 'Number of occurrences is required',
      path: ['recurrenceCount'],
    }
  );

type BookingFormSchema = z.infer<typeof bookingFormSchema>;

// ---------------------------------------------------------------------------
// Default form values
// ---------------------------------------------------------------------------

function getDefaultValues(localZone: string): BookingFormSchema {
  return {
    title: '',
    date: DateTime.local().toISODate() ?? '',
    startTime: '09:00',
    endTime: '10:00',
    timezone: localZone,
    primaryCalendarId: '',
    coBookedCalendarIds: [],
    resourceCalendarIds: [],
    attendances: [],
    externalAttendances: [],
    repeat: false,
    recurrenceFreq: 'WEEKLY',
    recurrenceInterval: 1,
    recurrenceEndType: 'never',
    recurrenceUntil: '',
    recurrenceCount: 10,
    recurrenceByday: [],
  };
}

// ---------------------------------------------------------------------------
// buildRRule — constructs a RecurrenceRule from form values
// ---------------------------------------------------------------------------

function buildRRule(values: BookingFormSchema): RecurrenceRule | null {
  if (!values.repeat) return null;

  const rule: RecurrenceRule = {
    freq: values.recurrenceFreq,
    interval:
      values.recurrenceInterval > 1 ? values.recurrenceInterval : undefined,
  };

  if (values.recurrenceEndType === 'on-date' && values.recurrenceUntil) {
    rule.until = values.recurrenceUntil;
  } else if (
    values.recurrenceEndType === 'after-n' &&
    values.recurrenceCount !== undefined
  ) {
    rule.count = values.recurrenceCount;
  }

  if (values.recurrenceFreq === 'WEEKLY' && values.recurrenceByday.length > 0) {
    rule.byday = values.recurrenceByday;
  }

  return rule;
}

// ---------------------------------------------------------------------------
// RecurrenceFields sub-component — gated behind the Repeat switch
// ---------------------------------------------------------------------------

interface RecurrenceFieldsProps {
  form: UseFormReturn<BookingFormSchema>;
}

function RecurrenceFields({ form }: RecurrenceFieldsProps) {
  const freq = form.watch('recurrenceFreq');
  const endType = form.watch('recurrenceEndType') as RecurrenceEndType;
  const byday = form.watch('recurrenceByday');
  const WEEKDAYS = weekdayMatrix();

  const handleBydayToggle = (code: string, checked: boolean) => {
    const current = form.getValues('recurrenceByday');
    if (checked) {
      form.setValue('recurrenceByday', [...current, code]);
    } else {
      form.setValue(
        'recurrenceByday',
        current.filter((c) => c !== code)
      );
    }
  };

  return (
    <VStack gap={3} p={3} border radius='md'>
      {/* Frequency */}
      <FormField
        control={form.control}
        name='recurrenceFreq'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Repeat</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='Frequency' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value='DAILY'>Daily</SelectItem>
                <SelectItem value='WEEKLY'>Weekly</SelectItem>
                <SelectItem value='MONTHLY'>Monthly</SelectItem>
                <SelectItem value='YEARLY'>Yearly</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Interval */}
      <FormField
        control={form.control}
        name='recurrenceInterval'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Every</FormLabel>
            <FormControl>
              <Input
                type='number'
                min={1}
                {...field}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
            </FormControl>
            <Text size='xs' color='muted-foreground'>
              {freq === 'DAILY'
                ? 'day(s)'
                : freq === 'WEEKLY'
                  ? 'week(s)'
                  : freq === 'MONTHLY'
                    ? 'month(s)'
                    : 'year(s)'}
            </Text>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* BYDAY — only for weekly */}
      {freq === 'WEEKLY' && (
        <VStack gap={2}>
          <Label>On days</Label>
          <HStack gap={2} wrap>
            {WEEKDAYS.map((day) => (
              <HStack key={day.byday} gap={1} align='center'>
                <Checkbox
                  id={`byday-${day.byday}`}
                  checked={byday.includes(day.byday)}
                  onCheckedChange={(checked) =>
                    handleBydayToggle(day.byday, Boolean(checked))
                  }
                />
                {/* cursor-pointer / select-none: pointer + selection affordances
                    have no token prop on the shadcn Label. */}
                <Label
                  htmlFor={`byday-${day.byday}`}
                  className='cursor-pointer select-none'
                >
                  {day.short}
                </Label>
              </HStack>
            ))}
          </HStack>
        </VStack>
      )}

      {/* End type */}
      <FormField
        control={form.control}
        name='recurrenceEndType'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ends</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='End type' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value='never'>Never</SelectItem>
                <SelectItem value='on-date'>On date</SelectItem>
                <SelectItem value='after-n'>After N occurrences</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Until date — only when endType = on-date */}
      {endType === 'on-date' && (
        <FormField
          control={form.control}
          name='recurrenceUntil'
          render={({ field }) => (
            <FormItem>
              <FormLabel>End date</FormLabel>
              <FormControl>
                <Input type='date' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Count — only when endType = after-n */}
      {endType === 'after-n' && (
        <FormField
          control={form.control}
          name='recurrenceCount'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Number of occurrences</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  min={1}
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </VStack>
  );
}

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

  // Fetch org-wide resource calendars — every member can book these.
  const { calendars: resourceCalendars, isLoading: resourceCalendarsLoading } =
    useResourceCalendars();

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
    defaultValues: getDefaultValues(localZone),
  });

  // Reset form + conflicts when the dialog opens/closes.
  React.useEffect(() => {
    if (!open) {
      form.reset(getDefaultValues(localZone));
      setConflicts(null);
      setIsPending(false);
    }
  }, [open, form, localZone]);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Build datetime strings for the API from form values.
   *
   * Returns two pairs:
   *  - `startDatetime`/`endDatetime`: full ISO with UTC offset, used for the
   *    availability-check query params (the backend needs unambiguous instants).
   *  - `startTimeLocal`/`endTimeLocal`: naive wall-clock "YYYY-MM-DDTHH:mm:ss"
   *    (no offset, no Z), used in the CREATE payload's start_time/end_time.
   *    The timezone is sent separately as the `timezone` field.
   */
  function buildDatetimes(values: BookingFormSchema) {
    const startISO = `${values.date}T${values.startTime}:00`;
    const endISO = `${values.date}T${values.endTime}:00`;
    const startDt = DateTime.fromISO(startISO, { zone: values.timezone });
    const endDt = DateTime.fromISO(endISO, { zone: values.timezone });
    return {
      startDatetime: startDt.toISO()!,
      endDatetime: endDt.toISO()!,
      startTimeLocal: toNaiveLocal(startDt),
      endTimeLocal: toNaiveLocal(endDt),
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

    const { startDatetime, endDatetime, startTimeLocal, endTimeLocal } =
      buildDatetimes(values);

    // Run availability checks for all calendars using the OFFSET form so the
    // backend can resolve exact instants for filtering.
    // For recurring events, we check only the first occurrence (same
    // startDatetime/endDatetime). Checking all occurrences of an unbounded
    // series is impractical; per-occurrence enforcement is the backend's job.
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

    // No conflicts — proceed with booking using NAIVE local times for the write
    // payload (the timezone is sent separately in the `timezone` field).
    await proceedWithBooking(values, primaryId, startTimeLocal, endTimeLocal);
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
      const attendances = values.attendances.map((a) => ({
        user_id: a.user_id,
      }));
      const external_attendances = values.externalAttendances.map((a) => ({
        external_attendee: { name: a.name || undefined, email: a.email },
      }));

      // Build recurrence: send rrule_string if the repeat toggle is on.
      // We prefer rrule_string over the structured recurrence_rule to avoid
      // duplication — the backend maps both to the same RecurrenceRule model.
      const rrule = buildRRule(values);
      const rrule_string = rrule ? serializeRRule(rrule) : undefined;

      const result = await createBooking({
        event: {
          title: values.title,
          start_time: startDatetime,
          end_time: endDatetime,
          timezone: values.timezone,
          calendar: primaryId,
          external_attendances,
          attendances,
          resource_allocations: values.resourceCalendarIds.map((id) => ({
            calendar: id,
          })),
          ...(rrule_string !== undefined ? { rrule_string } : {}),
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
    // Use naive local times for the write payload (offset form used for check above).
    const { startTimeLocal, endTimeLocal } = buildDatetimes(values);
    setConflicts(null);
    await proceedWithBooking(values, primaryId, startTimeLocal, endTimeLocal);
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
  const resourceCalendarIds = form.watch('resourceCalendarIds');
  const repeat = form.watch('repeat');

  // Attendee search — debounced so every keystroke doesn't fire a request.
  const [attendeeSearch, setAttendeeSearch] = React.useState('');
  const [debouncedAttendeeSearch, setDebouncedAttendeeSearch] =
    React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedAttendeeSearch(attendeeSearch), 300);
    return () => clearTimeout(t);
  }, [attendeeSearch]);
  const { members: attendeeOptions, isLoading: attendeesLoading } =
    useOrgMemberSearch(debouncedAttendeeSearch);

  const { fields: attendanceFields, replace: replaceAttendances } =
    useFieldArray({ control: form.control, name: 'attendances' });

  const {
    fields: externalFields,
    append: appendExternal,
    remove: removeExternal,
  } = useFieldArray({ control: form.control, name: 'externalAttendances' });

  // Calendars available for co-booking = all calendars except the primary one.
  const coBookableCalendars = React.useMemo(
    () =>
      calendars.filter(
        (cal) =>
          String(cal.id) !== primaryCalendarId && cal.visibility === 'active'
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
            <FormLayout
              gap={4}
              onSubmit={form.handleSubmit(onSubmit)}
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
                <Box grow basis={0}>
                  <FormField
                    control={form.control}
                    name='startTime'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start time</FormLabel>
                        <FormControl>
                          <Input type='time' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Box>
                <Box grow basis={0}>
                  <FormField
                    control={form.control}
                    name='endTime'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End time</FormLabel>
                        <FormControl>
                          <Input type='time' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Box>
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
                    <FormControl>
                      <Combobox
                        options={calendars
                          .filter((c) => c.visibility === 'active')
                          .map((cal) => ({
                            value: String(cal.id),
                            label: cal.name,
                          }))}
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={calendarsLoading}
                        placeholder='Select a calendar'
                        searchPlaceholder='Search calendars…'
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Co-booked calendars (multi-select via checkboxes) */}
              {primaryCalendarId && coBookableCalendars.length > 0 && (
                <VStack gap={2}>
                  <Label>Also block on (co-booked)</Label>
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
                        {/* cursor-pointer / select-none have no token prop on Label. */}
                        <Label
                          htmlFor={`co-book-${cal.id}`}
                          className='cursor-pointer select-none'
                        >
                          {cal.name}
                        </Label>
                      </HStack>
                    ))}
                  </VStack>
                </VStack>
              )}

              {/* Resource calendars — bookable by every member */}
              <VStack gap={2}>
                <Label htmlFor='resource-calendars'>Resource calendars</Label>
                <Combobox
                  multiple
                  id='resource-calendars'
                  options={resourceCalendars.map((cal) => ({
                    value: String(cal.id),
                    label: cal.name,
                  }))}
                  value={resourceCalendarIds.map(String)}
                  onValueChange={(values) =>
                    form.setValue(
                      'resourceCalendarIds',
                      values.map((v) => parseInt(v, 10))
                    )
                  }
                  disabled={resourceCalendarsLoading}
                  placeholder='Book resources (rooms, equipment)…'
                  searchPlaceholder='Search resources…'
                  emptyText='No resource calendars available.'
                />
              </VStack>

              {/* Internal attendees */}
              <VStack gap={2}>
                <Label htmlFor='internal-attendees'>Internal attendees</Label>
                <Combobox
                  multiple
                  id='internal-attendees'
                  options={attendeeOptions.map((m) => ({
                    value: String(m.id),
                    label: m.name,
                    description: m.email,
                  }))}
                  value={attendanceFields.map((f) => String(f.user_id))}
                  onValueChange={(values) =>
                    replaceAttendances(
                      values.map((v) => {
                        const id = parseInt(v, 10);
                        const opt = attendeeOptions.find((m) => m.id === id);
                        const existing = attendanceFields.find(
                          (f) => f.user_id === id
                        );
                        return {
                          user_id: id,
                          name: opt?.name ?? existing?.name ?? '',
                          email: opt?.email ?? existing?.email ?? '',
                        };
                      })
                    )
                  }
                  onSearchChange={setAttendeeSearch}
                  isLoading={attendeesLoading}
                  placeholder='Add internal attendees…'
                  searchPlaceholder='Search by name or email…'
                  emptyText={
                    debouncedAttendeeSearch
                      ? 'No members found.'
                      : 'Type to search members.'
                  }
                />
              </VStack>

              {/* External attendees */}
              <VStack gap={2}>
                <Label>External attendees</Label>
                {externalFields.map((field, index) => (
                  <VStack key={field.id} gap={2} p={2} border radius='md'>
                    <HStack gap={2} align='start'>
                      <Box grow basis={0}>
                        <FormField
                          control={form.control}
                          name={`externalAttendances.${index}.name`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>Name (optional)</FormLabel>
                              <FormControl>
                                <Input
                                  type='text'
                                  placeholder='Jane Doe'
                                  autoComplete='off'
                                  {...f}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </Box>
                      <Box grow basis={0}>
                        <FormField
                          control={form.control}
                          name={`externalAttendances.${index}.email`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input
                                  type='email'
                                  placeholder='jane@example.com'
                                  autoComplete='off'
                                  {...f}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </Box>
                    </HStack>
                    <HStack justify='end'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => removeExternal(index)}
                      >
                        Remove
                      </Button>
                    </HStack>
                  </VStack>
                ))}
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => appendExternal({ name: '', email: '' })}
                >
                  + Add external attendee
                </Button>
              </VStack>

              {/* Repeat toggle */}
              <HStack gap={3} align='center'>
                <Switch
                  id='repeat-toggle'
                  checked={repeat}
                  onCheckedChange={(checked) =>
                    form.setValue('repeat', checked)
                  }
                  aria-label='Enable recurring booking'
                />
                {/* cursor-pointer / select-none have no token prop on Label. */}
                <Label
                  htmlFor='repeat-toggle'
                  className='cursor-pointer select-none'
                >
                  Repeat
                </Label>
              </HStack>

              {/* Recurrence sub-form — gated behind the Repeat switch */}
              {repeat && <RecurrenceFields form={form} />}

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
            </FormLayout>
          )}
        </Form>
      </DialogContent>
    </Dialog>
  );
}
