'use client';

/**
 * BlockedTimeForm — rhf + zod form for creating one-off or recurring blocked times.
 *
 * Fields:
 *  - date (required) — date-only string (YYYY-MM-DD), specific date for the block
 *  - startTime (required) — time string (HH:MM)
 *  - endTime (required) — time string (HH:MM), must be after startTime
 *  - timezone — IANA timezone, defaulting to the member's local zone
 *  - reason (optional) — reason/description for the blocked time
 *  - repeat (bool) — enables the recurrence sub-form
 *  - recurrence sub-form: freq, interval, endType (never/on-date/after-n), until, count, byday
 *
 * Flow:
 *  1. On submit: serialize one-off or recurring blocked time based on the repeat toggle.
 *  2. Call createBlockedTime (one-off) or createRecurringBlockedTime (recurring).
 *  3. On success: toast + reset form.
 *  4. On error: toast with the error message.
 *
 * Recurrence strategy:
 *  - We send `rrule_string` (via serializeRRule) to the backend.
 *  - The date field is used as the anchor for one-off times; for recurring,
 *    the backend interprets the time portion + RRULE to determine the repeating
 *    windows.
 */

import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { DateTime } from 'luxon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
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
import { VStack, HStack, Stack, Text } from '@/components/layout';
import { useBlockedTimes } from '@/hooks/availability/use-blocked-times';
import {
  serializeRRule,
  toNaiveLocal,
  weekdayMatrix,
  type RecurrenceRule,
} from '@/lib/datetime/index';

// ---------------------------------------------------------------------------
// Recurrence end-type discriminant
// ---------------------------------------------------------------------------

type RecurrenceEndType = 'never' | 'on-date' | 'after-n';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const blockedTimeFormSchema = z
  .object({
    date: z.string().min(1, { message: 'Date is required' }),
    startTime: z.string().min(1, { message: 'Start time is required' }),
    endTime: z.string().min(1, { message: 'End time is required' }),
    timezone: z.string().min(1, { message: 'Timezone is required' }),
    reason: z.string().optional(),
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

type BlockedTimeFormSchema = z.infer<typeof blockedTimeFormSchema>;

// ---------------------------------------------------------------------------
// Default form values
// ---------------------------------------------------------------------------

function getDefaultValues(localZone: string): BlockedTimeFormSchema {
  return {
    date: DateTime.local().toISODate() ?? '',
    startTime: '09:00',
    endTime: '10:00',
    timezone: localZone,
    reason: '',
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

function buildRRule(values: BlockedTimeFormSchema): RecurrenceRule | null {
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
  form: UseFormReturn<BlockedTimeFormSchema>;
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
    <VStack gap={3} className='border-border rounded-md border p-3'>
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
          <label className='text-sm leading-none font-medium'>On days</label>
          <HStack gap={2} className='flex-wrap'>
            {WEEKDAYS.map((day) => (
              <HStack key={day.byday} gap={1} align='center'>
                <Checkbox
                  id={`blocked-byday-${day.byday}`}
                  checked={byday.includes(day.byday)}
                  onCheckedChange={(checked) =>
                    handleBydayToggle(day.byday, Boolean(checked))
                  }
                />
                <label
                  htmlFor={`blocked-byday-${day.byday}`}
                  className='cursor-pointer text-sm select-none'
                >
                  {day.short}
                </label>
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
// Main component
// ---------------------------------------------------------------------------

export interface BlockedTimeFormProps {
  /**
   * Optional calendar id to associate each created blocked time with.
   * Pass null to create blocked times unlinked from a specific calendar
   * (the backend scopes them to the member).
   */
  calendarId?: number | null;
}

export function BlockedTimeForm({ calendarId = null }: BlockedTimeFormProps) {
  const timezone =
    typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';

  const { createBlockedTime, createRecurringBlockedTime, isPending } =
    useBlockedTimes();

  const form = useForm<BlockedTimeFormSchema>({
    resolver: zodResolver(blockedTimeFormSchema),
    defaultValues: getDefaultValues(timezone),
  });

  const repeat = form.watch('repeat');

  async function onSubmit(values: BlockedTimeFormSchema) {
    try {
      if (values.repeat) {
        // Recurring blocked time
        const rrule = buildRRule(values);
        if (!rrule) {
          toast.error('Invalid recurrence settings');
          return;
        }

        const rruleString = serializeRRule(rrule);

        // Build naive local datetimes for the write payload. The date is used
        // only as an anchor; the backend uses the time + RRULE to determine
        // when the block repeats. The timezone is sent separately.
        const startDt = DateTime.fromISO(
          `${values.date}T${values.startTime}:00`,
          { zone: values.timezone }
        );
        const endDt = DateTime.fromISO(`${values.date}T${values.endTime}:00`, {
          zone: values.timezone,
        });

        await createRecurringBlockedTime(
          toNaiveLocal(startDt),
          toNaiveLocal(endDt),
          values.timezone,
          rruleString,
          values.reason || undefined,
          calendarId
        );

        toast.success('Recurring blocked time created', {
          description: `Block created with pattern: ${rruleString}`,
        });
      } else {
        // One-off blocked time on a specific date — emit naive local datetimes
        // (no offset, no Z). The timezone field carries the zone info.
        const startDt = DateTime.fromISO(
          `${values.date}T${values.startTime}:00`,
          { zone: values.timezone }
        );
        const endDt = DateTime.fromISO(`${values.date}T${values.endTime}:00`, {
          zone: values.timezone,
        });

        await createBlockedTime(
          toNaiveLocal(startDt),
          toNaiveLocal(endDt),
          values.timezone,
          values.reason || undefined,
          calendarId
        );

        toast.success('Blocked time created', {
          description: `Time blocked on ${values.date}.`,
        });
      }

      // Reset form after successful creation
      form.reset(getDefaultValues(timezone));
    } catch (err) {
      toast.error('Failed to create blocked time', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Stack gap={6}>
          {/* Basic fields */}
          <Stack gap={4}>
            <Text size='sm' weight='medium' color='foreground'>
              Block time details
            </Text>

            {/* Date */}
            <FormField
              control={form.control}
              name='date'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type='date' {...field} disabled={isPending} />
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
                      <Input type='time' {...field} disabled={isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Text size='sm' color='muted-foreground' className='pt-6'>
                –
              </Text>
              <FormField
                control={form.control}
                name='endTime'
                render={({ field }) => (
                  <FormItem className='flex-1'>
                    <FormLabel>End time</FormLabel>
                    <FormControl>
                      <Input type='time' {...field} disabled={isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </HStack>

            {/* Reason */}
            <FormField
              control={form.control}
              name='reason'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      placeholder='e.g., Personal time, Doctor appointment'
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Stack>

          {/* Repeat toggle */}
          <FormField
            control={form.control}
            name='repeat'
            render={({ field }) => (
              <FormItem className='border-border flex items-center justify-between rounded-lg border p-3'>
                <FormLabel className='mb-0'>Repeat this block</FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isPending}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Recurrence sub-form */}
          {repeat && (
            <>
              <div className='border-border border-t' />
              <RecurrenceFields form={form} />
            </>
          )}

          {/* Footer */}
          <HStack gap={3} className='justify-end'>
            <Button
              type='button'
              variant='outline'
              onClick={() => form.reset(getDefaultValues(timezone))}
              disabled={isPending}
            >
              Reset
            </Button>
            <Button type='submit' disabled={isPending}>
              {isPending ? 'Creating…' : 'Create blocked time'}
            </Button>
          </HStack>
        </Stack>
      </form>
    </Form>
  );
}
