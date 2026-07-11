'use client';

/**
 * AvailabilityEditor — lets a member configure weekly recurring time windows
 * and ad-hoc date-specific windows.
 *
 * Weekly section:
 *   7 rows (Mon–Sun) driven by weekdayMatrix(). Each row has a list of
 *   time-range entries (start/end HH:MM). Clicking "Add" appends a row;
 *   clicking the remove button deletes it. On Save the form serialises
 *   each non-empty weekday's ranges to AvailableTimeWritable entries with
 *   rrule_string = "FREQ=WEEKLY;BYDAY=<DAY>" and start_time/end_time as
 *   ISO datetimes anchored to the UNIX epoch date (2024-01-01) in the
 *   user's local timezone. The backend interprets the time portion and the
 *   RRULE byday to determine when the member is available each week.
 *
 * Ad-hoc section:
 *   A list of (date, startTime, endTime) entries for specific calendar
 *   dates. These are serialised WITHOUT an rrule_string.
 *
 * Save strategy:
 *   A single bulk-create call replaces the session's intent. Existing
 *   server-side windows persist until the member explicitly removes or saves
 *   over them. This is a "replace with new intent" model — the caller starts
 *   from the currently loaded windows and mutates them in the form state.
 *
 * Timezone:
 *   Uses the browser's local timezone (Intl.DateTimeFormat) as the default.
 *   This is stored on each AvailableTimeWritable.timezone so the backend
 *   computes correct UTC moments.
 */

import * as React from 'react';
import { useForm, useFieldArray, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@vinta-schedule/design-system/ui/button';
import { Input } from '@vinta-schedule/design-system/ui/input';
import { Skeleton } from '@vinta-schedule/design-system/ui/skeleton';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@vinta-schedule/design-system/ui/form';
import { HStack, Stack, Text } from '@vinta-schedule/design-system/layout';
import { weekdayMatrix, type WeekdayEntry } from '@/lib/datetime/index';
import { useAvailableTimes } from '@/hooks/availability/use-available-times';
import type {
  AvailableTime,
  AvailableTimeWritable,
  AvailableTimeOperation,
} from '@/client';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const timeRangeSchema = z
  .object({
    startTime: z.string().min(1, { message: 'Start time is required' }),
    endTime: z.string().min(1, { message: 'End time is required' }),
  })
  .refine(
    (d) => {
      if (!d.startTime || !d.endTime) return true;
      return d.endTime > d.startTime;
    },
    { message: 'End must be after start', path: ['endTime'] }
  );

const adHocEntrySchema = z
  .object({
    date: z.string().min(1, { message: 'Date is required' }),
    startTime: z.string().min(1, { message: 'Start time is required' }),
    endTime: z.string().min(1, { message: 'End time is required' }),
  })
  .refine(
    (d) => {
      if (!d.startTime || !d.endTime) return true;
      return d.endTime > d.startTime;
    },
    { message: 'End must be after start', path: ['endTime'] }
  );

// One entry per weekday (7 total, fixed by weekdayMatrix).
// Each weekday has a list of time-range rows.
const weekdayRowSchema = z.object({
  ranges: z.array(timeRangeSchema),
});

const availabilityFormSchema = z.object({
  weekdays: z.array(weekdayRowSchema),
  adHoc: z.array(adHocEntrySchema),
});

type AvailabilityFormSchema = z.infer<typeof availabilityFormSchema>;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

function makeDefaultValues(): AvailabilityFormSchema {
  return {
    weekdays: weekdayMatrix().map(() => ({ ranges: [] })),
    adHoc: [],
  };
}

// ---------------------------------------------------------------------------
// De-serialisation: server → form values
// ---------------------------------------------------------------------------

/**
 * Byday code → weekday matrix index mapping.
 * Matches weekdayMatrix() order: 0=MO, 1=TU, …, 6=SU.
 */
const BYDAY_TO_INDEX: Record<string, number> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6,
};

/**
 * Build form default values from a list of saved AvailableTime entries.
 *
 * - Weekly recurring entries (is_recurring=true, recurrence_rule.by_weekday set):
 *   extract HH:mm from start_time/end_time via literal substring (no tz-convert)
 *   and push a range into each matching weekday row.
 * - Ad-hoc entries (not recurring, or no by_weekday): extract date + HH:mm and
 *   add to adHoc list.
 */
function buildDefaultsFromAvailableTimes(
  availableTimes: AvailableTime[]
): AvailabilityFormSchema {
  const defaults = makeDefaultValues();

  for (const entry of availableTimes) {
    // Literal wall-clock extraction — do NOT timezone-convert; the stored value
    // already matches what weeklyEntryToWritable wrote (naive local datetime).
    const startTime = entry.start_time.slice(11, 16); // "HH:mm"
    const endTime = entry.end_time.slice(11, 16); // "HH:mm"

    const byWeekday = entry.recurrence_rule?.by_weekday;

    if (entry.is_recurring && byWeekday) {
      // Weekly pattern — by_weekday may be a comma list like "MO,WE"
      const codes = byWeekday.split(',').map((c) => c.trim().toUpperCase());
      for (const code of codes) {
        const idx = BYDAY_TO_INDEX[code];
        if (idx !== undefined) {
          defaults.weekdays[idx].ranges.push({ startTime, endTime });
        }
      }
    } else {
      // Ad-hoc (non-recurring or no weekday recurrence)
      const date = entry.start_time.slice(0, 10); // "YYYY-MM-DD"
      defaults.adHoc.push({ date, startTime, endTime });
    }
  }

  return defaults;
}

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

/**
 * Convert a weekday + time-range into an AvailableTimeWritable with a weekly
 * RRULE. We anchor the date to an arbitrary Monday (2024-01-01, which IS a
 * Monday) and shift forward by the weekday index so the date part is valid.
 * The backend uses only the time portion + BYDAY from the rrule to determine
 * when the member is available.
 */
function weeklyEntryToWritable(
  weekday: WeekdayEntry,
  startTime: string,
  endTime: string,
  timezone: string,
  calendarId: number | null
): AvailableTimeWritable {
  // Anchor to 2024-01-01 (Monday) and advance by weekday index.
  const anchorDate = new Date(2024, 0, 1 + weekday.index);
  const yyyy = anchorDate.getFullYear();
  const mm = String(anchorDate.getMonth() + 1).padStart(2, '0');
  const dd = String(anchorDate.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  return {
    start_time: `${dateStr}T${startTime}:00`,
    end_time: `${dateStr}T${endTime}:00`,
    timezone,
    rrule_string: `FREQ=WEEKLY;BYDAY=${weekday.byday}`,
    calendar: calendarId,
  };
}

/**
 * Convert an ad-hoc date entry into an AvailableTimeWritable WITHOUT an
 * rrule_string (no recurrence — it's a one-time window on a specific date).
 */
function adHocEntryToWritable(
  date: string,
  startTime: string,
  endTime: string,
  timezone: string,
  calendarId: number | null
): AvailableTimeWritable {
  return {
    start_time: `${date}T${startTime}:00`,
    end_time: `${date}T${endTime}:00`,
    timezone,
    calendar: calendarId,
  };
}

/**
 * Build the full list of AvailableTimeWritable from the form values.
 */
function buildPayload(
  values: AvailabilityFormSchema,
  timezone: string,
  calendarId: number | null
): AvailableTimeWritable[] {
  const result: AvailableTimeWritable[] = [];
  const weekdays = weekdayMatrix();

  values.weekdays.forEach((row, idx) => {
    const weekday = weekdays[idx];
    for (const range of row.ranges) {
      if (range.startTime && range.endTime) {
        result.push(
          weeklyEntryToWritable(
            weekday,
            range.startTime,
            range.endTime,
            timezone,
            calendarId
          )
        );
      }
    }
  });

  for (const entry of values.adHoc) {
    if (entry.date && entry.startTime && entry.endTime) {
      result.push(
        adHocEntryToWritable(
          entry.date,
          entry.startTime,
          entry.endTime,
          timezone,
          calendarId
        )
      );
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface WeekdayRowProps {
  weekday: WeekdayEntry;
  weekdayIndex: number;
  form: UseFormReturn<AvailabilityFormSchema>;
  disabled: boolean;
}

function WeekdayRow({
  weekday,
  weekdayIndex,
  form,
  disabled,
}: WeekdayRowProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `weekdays.${weekdayIndex}.ranges`,
  });

  return (
    <Stack gap={2}>
      <HStack gap={3} className='items-start'>
        <Text
          size='sm'
          weight='medium'
          className='w-10 shrink-0 pt-2'
          color='foreground'
        >
          {weekday.short}
        </Text>
        <Stack gap={2} className='flex-1'>
          {fields.length === 0 ? (
            <Text size='sm' color='muted-foreground' className='py-2'>
              No availability set
            </Text>
          ) : (
            fields.map((field, rangeIdx) => (
              <HStack key={field.id} gap={2} className='items-start'>
                <FormField
                  control={form.control}
                  name={`weekdays.${weekdayIndex}.ranges.${rangeIdx}.startTime`}
                  render={({ field: f }) => (
                    <FormItem className='flex-1'>
                      <FormLabel className='sr-only'>Start time</FormLabel>
                      <FormControl>
                        <Input
                          type='time'
                          {...f}
                          disabled={disabled}
                          aria-label={`${weekday.label} window ${rangeIdx + 1} start time`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Text size='sm' color='muted-foreground' className='pt-2'>
                  –
                </Text>
                <FormField
                  control={form.control}
                  name={`weekdays.${weekdayIndex}.ranges.${rangeIdx}.endTime`}
                  render={({ field: f }) => (
                    <FormItem className='flex-1'>
                      <FormLabel className='sr-only'>End time</FormLabel>
                      <FormControl>
                        <Input
                          type='time'
                          {...f}
                          disabled={disabled}
                          aria-label={`${weekday.label} window ${rangeIdx + 1} end time`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={() => remove(rangeIdx)}
                  disabled={disabled}
                  aria-label={`Remove ${weekday.label} window ${rangeIdx + 1}`}
                >
                  <Trash2 className='h-4 w-4' />
                </Button>
              </HStack>
            ))
          )}
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => append({ startTime: '09:00', endTime: '17:00' })}
            disabled={disabled}
            className='w-fit'
          >
            <Plus className='mr-1 h-3 w-3' />
            Add
          </Button>
        </Stack>
      </HStack>
    </Stack>
  );
}

interface AdHocSectionProps {
  form: UseFormReturn<AvailabilityFormSchema>;
  disabled: boolean;
}

function AdHocSection({ form, disabled }: AdHocSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'adHoc',
  });

  return (
    <Stack gap={3}>
      <Text size='sm' weight='medium' color='foreground'>
        Specific dates
      </Text>
      {fields.length === 0 && (
        <Text size='sm' color='muted-foreground'>
          No ad-hoc availability set
        </Text>
      )}
      {fields.map((field, idx) => (
        <HStack key={field.id} gap={2} className='items-start'>
          <FormField
            control={form.control}
            name={`adHoc.${idx}.date`}
            render={({ field: f }) => (
              <FormItem className='flex-1'>
                <FormLabel className='sr-only'>Date</FormLabel>
                <FormControl>
                  <Input
                    type='date'
                    {...f}
                    disabled={disabled}
                    aria-label={`Ad-hoc window ${idx + 1} date`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`adHoc.${idx}.startTime`}
            render={({ field: f }) => (
              <FormItem className='flex-1'>
                <FormLabel className='sr-only'>Start time</FormLabel>
                <FormControl>
                  <Input
                    type='time'
                    {...f}
                    disabled={disabled}
                    aria-label={`Ad-hoc window ${idx + 1} start time`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Text size='sm' color='muted-foreground' className='pt-2'>
            –
          </Text>
          <FormField
            control={form.control}
            name={`adHoc.${idx}.endTime`}
            render={({ field: f }) => (
              <FormItem className='flex-1'>
                <FormLabel className='sr-only'>End time</FormLabel>
                <FormControl>
                  <Input
                    type='time'
                    {...f}
                    disabled={disabled}
                    aria-label={`Ad-hoc window ${idx + 1} end time`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={() => remove(idx)}
            disabled={disabled}
            aria-label={`Remove ad-hoc window ${idx + 1}`}
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </HStack>
      ))}
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={() =>
          append({
            date: '',
            startTime: '09:00',
            endTime: '17:00',
          })
        }
        disabled={disabled}
        className='w-fit'
      >
        <Plus className='mr-1 h-3 w-3' />
        Add specific date
      </Button>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface AvailabilityEditorProps {
  /**
   * Optional calendar id to associate each created window with.
   * Pass null to create windows unlinked from a specific calendar
   * (the backend scopes them to the member).
   */
  calendarId?: number | null;
}

export function AvailabilityEditor({
  calendarId = null,
}: AvailabilityEditorProps) {
  const timezone =
    typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';

  const { batchUpdate, isPending, availableTimes, isLoading } =
    useAvailableTimes();

  const weekdays = weekdayMatrix();

  const form = useForm<AvailabilityFormSchema>({
    resolver: zodResolver(availabilityFormSchema),
    defaultValues: makeDefaultValues(),
  });

  // The stored rows currently on the server — the baseline for delete ops.
  // Seeded from the query on first load, then kept in sync with each batch
  // RESPONSE so a second save (without a page refresh) deletes the rows the
  // previous save created instead of re-creating duplicates.
  const [savedTimes, setSavedTimes] = React.useState<AvailableTime[]>([]);

  // Hydrate form + baseline once from server data on first successful load.
  // hasHydratedRef guards against resetting over subsequent user edits.
  const hasHydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (hasHydratedRef.current) return;
    if (isLoading) return;
    hasHydratedRef.current = true;
    form.reset(buildDefaultsFromAvailableTimes(availableTimes));
    setSavedTimes(availableTimes);
  }, [isLoading, availableTimes, form]);

  async function onSubmit(values: AvailabilityFormSchema) {
    const payload = buildPayload(values, timezone, calendarId);

    // Atomic full-replace: delete every existing stored window, then create the
    // desired set. The form's matrix doesn't track per-row ids, so a clean
    // delete-all + create-all is the safest atomic representation of "this is my
    // schedule now" (and is the only way to remove old rows — bulk-create can't).
    // Deletes target `savedTimes` (the current server state), never expanded
    // recurring instances.
    const deleteOps: AvailableTimeOperation[] = savedTimes
      .filter((at) => !at.is_recurring_instance)
      .map((at) => ({ action: 'delete', id: at.id }));

    const createOps: AvailableTimeOperation[] = payload.map((w) => ({
      action: 'create',
      start_time: w.start_time,
      end_time: w.end_time,
      timezone: w.timezone,
      ...(w.rrule_string ? { rrule_string: w.rrule_string } : {}),
    }));

    const operations = [...deleteOps, ...createOps];

    if (operations.length === 0) {
      toast.error('No availability windows to save', {
        description: 'Add at least one time window before saving.',
      });
      return;
    }

    try {
      // Update the delete-baseline from the response so the next save replaces
      // these rows instead of re-creating them.
      const newList = await batchUpdate(operations, calendarId);
      setSavedTimes(newList);
      toast.success('Availability saved', {
        description:
          payload.length === 0
            ? 'Availability cleared.'
            : `${payload.length} window${payload.length === 1 ? '' : 's'} saved.`,
      });
    } catch (err) {
      toast.error('Failed to save availability', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  if (isLoading) {
    return (
      <Stack gap={3} aria-label='Loading availability'>
        {[1, 2, 3, 4].map((n) => (
          <Skeleton key={n} className='h-10 w-full rounded-md' />
        ))}
      </Stack>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Stack gap={6}>
          {/* Weekly section */}
          <Stack gap={4}>
            <Text size='sm' weight='medium' color='foreground'>
              Weekly availability
            </Text>
            <Text size='sm' color='muted-foreground'>
              Set recurring time windows by day of the week. These repeat every
              week.
            </Text>
            <Stack gap={3}>
              {weekdays.map((weekday, idx) => (
                <React.Fragment key={weekday.byday}>
                  <WeekdayRow
                    weekday={weekday}
                    weekdayIndex={idx}
                    form={form}
                    disabled={isPending}
                  />
                  {idx < weekdays.length - 1 && (
                    <div className='border-border my-1 border-t' />
                  )}
                </React.Fragment>
              ))}
            </Stack>
          </Stack>

          {/* Ad-hoc section */}
          <div className='border-border border-t' />
          <AdHocSection form={form} disabled={isPending} />

          {/* Footer */}
          <HStack gap={3} className='justify-end'>
            <Button
              type='button'
              variant='outline'
              onClick={() =>
                form.reset(buildDefaultsFromAvailableTimes(availableTimes))
              }
              disabled={isPending}
            >
              Reset
            </Button>
            <Button type='submit' disabled={isPending}>
              {isPending ? 'Saving…' : 'Save availability'}
            </Button>
          </HStack>
        </Stack>
      </form>
    </Form>
  );
}
