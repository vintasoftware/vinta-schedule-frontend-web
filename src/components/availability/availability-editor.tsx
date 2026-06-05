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
import { HStack, Stack, Text } from '@/components/layout';
import { weekdayMatrix, type WeekdayEntry } from '@/lib/datetime/index';
import { useAvailableTimes } from '@/hooks/availability/use-available-times';
import type { AvailableTimeWritable } from '@/client';

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

  const { bulkCreate, isPending } = useAvailableTimes();

  const weekdays = weekdayMatrix();

  const form = useForm<AvailabilityFormSchema>({
    resolver: zodResolver(availabilityFormSchema),
    defaultValues: makeDefaultValues(),
  });

  async function onSubmit(values: AvailabilityFormSchema) {
    const payload = buildPayload(values, timezone, calendarId);

    if (payload.length === 0) {
      toast.error('No availability windows to save', {
        description: 'Add at least one time window before saving.',
      });
      return;
    }

    try {
      await bulkCreate(payload);
      toast.success('Availability saved', {
        description: `${payload.length} window${payload.length === 1 ? '' : 's'} saved.`,
      });
    } catch (err) {
      toast.error('Failed to save availability', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
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
              onClick={() => form.reset(makeDefaultValues())}
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
