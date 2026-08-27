'use client';

/**
 * GroupBlockForm — rhf + zod form to create or edit one group-scoped blocked
 * time for one calendar in one slot (Phase 4). Follows the shape of
 * blocked-time-form.tsx (date + start/end time + timezone + reason + an
 * optional repeat sub-form, `serializeRRule` for the write payload), adapted
 * to the group-scoped write shape (`GroupScopedBlockedTimeCreate` /
 * `PatchedGroupScopedBlockedTimeUpdate` — full ISO `start_time`/`end_time`
 * plus a separate `timezone`, matching group-scoped-types.ts's
 * `buildWindowCreateBody`/`buildWindowUpdateBody` convention, not the base
 * blocked-time form's naive-local-string convention).
 *
 * No Dialog chrome here on purpose — the caller (group-block-list.tsx) owns
 * the Dialog and decides when to mount/unmount this form. That matters for
 * two things:
 *
 * 1. EDIT MODE HYDRATION. `block` is a plain prop, not fetched by this
 *    component — the caller already has it loaded (it came from the row the
 *    admin clicked "Edit" on). `useForm`'s `defaultValues` are evaluated
 *    ONCE, at mount, from that prop, so the form is correct from its very
 *    first render. The caller is responsible for giving this component a
 *    fresh mount (e.g. `key={block?.id ?? 'create'}`) whenever it switches
 *    between create mode, editing block A, and editing block B — see
 *    group-block-list.tsx. This sidesteps the Radix `Select` hydration bug
 *    group-window-grid.tsx hit (a controlled value that changes AFTER mount,
 *    before the dropdown has ever been opened, gets silently reset to '' by
 *    Radix's own onValueChange — see that file's `hydrationGeneration`
 *    comment): there is no post-mount value change to guard against here,
 *    because the value is right the first time.
 *
 * 2. TRI-STATE PATCH FIELDS. On edit, `reason` and `rrule_string` are each
 *    independently optional on the PATCH body — omitting either leaves it
 *    unchanged server-side (see UpdateBlockInput's doc comment). This
 *    component derives "did the admin touch this" from react-hook-form's
 *    own dirty-field tracking (`form.formState.dirtyFields`) rather than a
 *    second, hand-rolled "touched" flag, EXCEPT for the BYDAY checkboxes:
 *    RHF's `setValue` does not mark a field dirty unless told to
 *    (`{ shouldDirty: true }`), so `handleBydayToggle` passes that
 *    explicitly — otherwise toggling only a weekday on an existing
 *    recurrence would silently fall into the "untouched" branch and never
 *    reach the server.
 *
 * Every create AND update runs orphan detection on the backend (unlike
 * windows, where only the calendar's first window in the slot or a
 * narrowing update does) — see use-group-scoped-blocks.ts's doc comment.
 * This component reports the write result's `orphanedBookings` back to its
 * caller via `onSaved` rather than rendering `OrphanedBookingsAlert` itself,
 * because the alert needs to persist after this form's Dialog closes (the
 * admin dismisses it on their own schedule, not the form's).
 *
 * A 402 over-limit rejection is rendered INLINE, in this form, rather than
 * bubbled up — unlike the orphan case, a rejected write has nothing to hand
 * off: the point of showing it here is so the admin's in-progress edit stays
 * on screen (Dialog stays open) to undo and retry, matching
 * group-window-grid.tsx's UC-6 handling. Blocked-time writes are not
 * plan-limit gated at the single-write level per the handoff doc, but a
 * RESTRICTED billing org still rejects with a 402 carrying the same shape —
 * `readOverLimitError` is reused unchanged, and anything it doesn't match
 * falls through to an ordinary error toast.
 */

import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'vinta-schedule-design-system/ui/alert';
import { Checkbox } from 'vinta-schedule-design-system/ui/checkbox';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Label } from 'vinta-schedule-design-system/ui/label';
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
import {
  Box,
  Divider,
  FormLayout,
  HStack,
  Stack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';
import {
  DateTime,
  parseRRule,
  serializeRRule,
  weekdayMatrix,
  type RecurrenceRule,
} from '@/lib/datetime/index';
import { useGroupScopedBlocks } from '@/hooks/calendar-groups/use-group-scoped-blocks';
import { getApiErrorMessage, readOverLimitError } from '@/lib/utils/api-errors';
import { OverLimitAlert } from './over-limit-alert';
import type { OrphanedBooking } from './orphaned-bookings-alert';
import type { GroupScopedBlockedTime } from '@/client';

// All IANA zone names the runtime's ICU data knows about -- replaces a
// free-text input a typo could turn into an invalid zone (see the `.refine`
// on `groupBlockFormSchema.timezone`).
const TIME_ZONES = Intl.supportedValuesOf('timeZone');

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

type RecurrenceEndType = 'never' | 'on-date' | 'after-n';

const groupBlockFormSchema = z
  .object({
    date: z.string().min(1, { message: 'Date is required' }),
    startTime: z.string().min(1, { message: 'Start time is required' }),
    endTime: z.string().min(1, { message: 'End time is required' }),
    timezone: z
      .string()
      .min(1, { message: 'Timezone is required' })
      // A `min(1)` check alone accepts any non-empty string, including a
      // typo'd zone -- that shipped as a bug in group-window-grid.tsx's
      // predecessor, silently POSTing `start_time: null`. Validate the zone
      // actually resolves instead.
      .refine((tz) => DateTime.local().setZone(tz).isValid, {
        message: 'Unknown timezone',
      }),
    reason: z.string().optional(),
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
    { message: 'End time must be after start time', path: ['endTime'] }
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

type GroupBlockFormSchema = z.infer<typeof groupBlockFormSchema>;

// ---------------------------------------------------------------------------
// Default / hydrated form values
// ---------------------------------------------------------------------------

function getDefaultValues(timezone: string): GroupBlockFormSchema {
  return {
    date: DateTime.local().toISODate() ?? '',
    startTime: '09:00',
    endTime: '10:00',
    timezone,
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

/**
 * Hydrates the form from an existing block for edit mode. The recurrence
 * sub-fields are a best-effort round-trip through `parseRRule` (which
 * silently ignores parts it doesn't recognize) purely to populate the UI.
 *
 * CORRECTION: an earlier version of this comment claimed "an imperfect
 * display round-trip can never overwrite the block's actual stored rule",
 * on the theory that untouched recurrence fields keep `rrule_string` out of
 * the PATCH body entirely. That claim was FALSE for one shape: `parseRRule`
 * parses `BYDAY` regardless of `FREQ`, but `RecurrenceFields` only renders
 * the day checkboxes when `recurrenceFreq === 'WEEKLY'`, and
 * `buildRecurrenceRule` only re-emits `byday` for `WEEKLY` too. A block
 * stored as e.g. `FREQ=MONTHLY;BYDAY=MO,WE` hydrates `recurrenceByday` with
 * data the admin can neither see nor re-touch -- editing only
 * `recurrenceInterval` or `recurrenceEndType` (both visible and editable for
 * every frequency) marks `recurrenceDirty`, and the PATCH would silently
 * rewrite the rule with the BYDAY restriction dropped.
 *
 * `isUnrepresentableRecurrence` below detects this shape on load, and the
 * form (`recurrenceLocked` state, see the main component) disables the
 * whole recurrence sub-form for that block -- classify-and-refuse,
 * mirroring `classifyWindow` in group-scoped-types.ts for the weekday grid.
 * The admin's only path to change such a rule is to turn Repeat off (which
 * clears `rrule_string`, an explicit PATCH of `null`) and, if wanted, turn
 * it back on to compose a brand-new rule from scratch. Every OTHER shape
 * (no BYDAY, or BYDAY only under WEEKLY) genuinely round-trips through this
 * form and is unaffected.
 */
function blockToFormValues(
  block: GroupScopedBlockedTime
): GroupBlockFormSchema {
  const start = DateTime.fromISO(block.start_time, { zone: block.timezone });
  const end = DateTime.fromISO(block.end_time, { zone: block.timezone });
  const recurrence: RecurrenceRule | null = block.rrule_string
    ? parseRRule(block.rrule_string)
    : null;

  return {
    date: start.isValid ? (start.toISODate() ?? '') : '',
    startTime: start.isValid ? start.toFormat('HH:mm') : '',
    endTime: end.isValid ? end.toFormat('HH:mm') : '',
    timezone: block.timezone,
    reason: block.reason ?? '',
    repeat: recurrence !== null,
    recurrenceFreq: recurrence?.freq ?? 'WEEKLY',
    recurrenceInterval: recurrence?.interval ?? 1,
    recurrenceEndType: recurrence?.until
      ? 'on-date'
      : recurrence?.count !== undefined
        ? 'after-n'
        : 'never',
    // `until` can be a full ISO datetime when the stored UNTIL was a
    // DATE-TIME value (parseRRule), but this binds to `<Input type='date'>`,
    // which only accepts `YYYY-MM-DD` -- slice to the date part so an
    // otherwise-valid block doesn't hydrate into a blank/invalid control.
    recurrenceUntil: recurrence?.until ? recurrence.until.slice(0, 10) : '',
    recurrenceCount: recurrence?.count ?? 10,
    recurrenceByday: recurrence?.byday ?? [],
  };
}

/**
 * True when `recurrence` carries a `BYDAY` restriction under a non-WEEKLY
 * `FREQ` -- the one shape this form's recurrence sub-form cannot safely
 * round-trip. See `blockToFormValues`'s doc comment for why.
 */
function isUnrepresentableRecurrence(
  recurrence: RecurrenceRule | null
): boolean {
  return (
    recurrence !== null &&
    recurrence.freq !== 'WEEKLY' &&
    (recurrence.byday?.length ?? 0) > 0
  );
}

function buildRecurrenceRule(values: GroupBlockFormSchema): RecurrenceRule {
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

/**
 * `DateTime#toISO()` types as `string | null` -- null only for an invalid
 * DateTime (e.g. an unrecognized zone). Throwing here rather than asserting
 * non-null keeps an invalid zone from silently POSTing `start_time: null`
 * (see group-scoped-types.ts's `requireISO`, the same fix applied there).
 */
function requiredISO(dt: DateTime, label: string): string {
  const iso = dt.toISO();
  if (iso === null) {
    throw new Error(`Could not compute ${label}: invalid timezone`);
  }
  return iso;
}

// ---------------------------------------------------------------------------
// RecurrenceFields sub-component -- gated behind the Repeat switch
// ---------------------------------------------------------------------------

interface RecurrenceFieldsProps {
  form: UseFormReturn<GroupBlockFormSchema>;
  disabled: boolean;
  /**
   * True when this block's stored recurrence can't be safely edited here
   * (see `isUnrepresentableRecurrence`). Every control below is disabled and
   * an alert explains the admin's only path: turn Repeat off to clear the
   * rule, then back on to compose a new one.
   */
  locked: boolean;
}

function RecurrenceFields({ form, disabled, locked }: RecurrenceFieldsProps) {
  const freq = form.watch('recurrenceFreq');
  const endType = form.watch('recurrenceEndType') as RecurrenceEndType;
  const byday = form.watch('recurrenceByday');
  const WEEKDAYS = weekdayMatrix();
  const fieldsDisabled = disabled || locked;

  const handleBydayToggle = (code: string, checked: boolean) => {
    const current = form.getValues('recurrenceByday');
    const next = checked
      ? [...current, code]
      : current.filter((c) => c !== code);
    // shouldDirty: true -- setValue does NOT mark a field dirty by default,
    // and the edit-mode tri-state rrule_string logic below depends on
    // dirtyFields.recurrenceByday to know the admin touched recurrence (see
    // the module doc comment).
    form.setValue('recurrenceByday', next, { shouldDirty: true });
  };

  return (
    <VStack gap={3} p={3} border radius='md' data-testid='block-repeat-fields'>
      {locked && (
        <Alert data-testid='block-recurrence-locked'>
          <AlertTitle>This recurrence can&apos;t be edited here</AlertTitle>
          <AlertDescription>
            This block repeats on specific days combined with a frequency this
            form doesn&apos;t support editing here. Turn Repeat off to clear the
            rule, then back on to set a new one.
          </AlertDescription>
        </Alert>
      )}
      <FormField
        control={form.control}
        name='recurrenceFreq'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Repeat</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value}
              disabled={fieldsDisabled}
            >
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
                disabled={fieldsDisabled}
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

      {freq === 'WEEKLY' && (
        <VStack gap={2}>
          <Label>On days</Label>
          <HStack gap={2} wrap>
            {WEEKDAYS.map((day) => (
              <HStack key={day.byday} gap={1} align='center'>
                <Checkbox
                  id={`group-block-byday-${day.byday}`}
                  checked={byday.includes(day.byday)}
                  disabled={fieldsDisabled}
                  onCheckedChange={(checked) =>
                    handleBydayToggle(day.byday, Boolean(checked))
                  }
                />
                {/* cursor-pointer / select-none: pointer + selection
                    affordances have no token prop on the shadcn Label. */}
                <Label
                  htmlFor={`group-block-byday-${day.byday}`}
                  className='cursor-pointer select-none'
                >
                  {day.short}
                </Label>
              </HStack>
            ))}
          </HStack>
        </VStack>
      )}

      <FormField
        control={form.control}
        name='recurrenceEndType'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ends</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value}
              disabled={fieldsDisabled}
            >
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

      {endType === 'on-date' && (
        <FormField
          control={form.control}
          name='recurrenceUntil'
          render={({ field }) => (
            <FormItem>
              <FormLabel>End date</FormLabel>
              <FormControl>
                <Input type='date' {...field} disabled={fieldsDisabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

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
                  disabled={fieldsDisabled}
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

export interface GroupBlockFormProps {
  groupId: number;
  slotId: number;
  calendarId: number;
  /** Existing block to edit; omit (or pass undefined) for create mode. */
  block?: GroupScopedBlockedTime;
  /**
   * Called after a successful create or update, with the write's orphaned
   * bookings already tagged with the timezone this write was made in (see
   * the module doc comment). The caller decides what to do with the alert
   * and when to close its Dialog -- this form does neither.
   */
  onSaved?: (result: { orphanedBookings: OrphanedBooking[] }) => void;
  onCancel?: () => void;
}

export function GroupBlockForm({
  groupId,
  slotId,
  calendarId,
  block,
  onSaved,
  onCancel,
}: GroupBlockFormProps) {
  const isEdit = block !== undefined;

  const viewerTimezone =
    typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';

  const { createBlock, updateBlock } = useGroupScopedBlocks({
    groupId,
    slotId,
    calendarId,
    // The list this hook would otherwise fetch is already loaded by the
    // caller (group-block-list.tsx uses the same hook, same query key, so
    // TanStack Query dedupes it) -- this form only needs the mutation
    // functions, not a second read of the list.
    enabled: false,
  });

  const form = useForm<GroupBlockFormSchema>({
    resolver: zodResolver(groupBlockFormSchema),
    defaultValues: block
      ? blockToFormValues(block)
      : getDefaultValues(viewerTimezone),
  });

  const [isSaving, setIsSaving] = React.useState(false);
  const [overLimitError, setOverLimitError] = React.useState<ReturnType<
    typeof readOverLimitError
  > | null>(null);
  // Classify-and-refuse gate for the BLOCKER described in
  // `blockToFormValues`'s doc comment -- computed once from the block this
  // form mounted with (never re-evaluated on prop changes; the caller
  // remounts this form per block, see the module doc comment on hydration).
  const [recurrenceLocked, setRecurrenceLocked] = React.useState(() =>
    block?.rrule_string
      ? isUnrepresentableRecurrence(parseRRule(block.rrule_string))
      : false
  );

  const repeat = form.watch('repeat');

  async function onSubmit(values: GroupBlockFormSchema) {
    setIsSaving(true);
    setOverLimitError(null);
    try {
      const start = DateTime.fromISO(`${values.date}T${values.startTime}:00`, {
        zone: values.timezone,
      });
      const end = DateTime.fromISO(`${values.date}T${values.endTime}:00`, {
        zone: values.timezone,
      });
      const startISO = requiredISO(start, 'start time');
      const endISO = requiredISO(end, 'end time');

      if (isEdit && block) {
        // Tri-state PATCH fields -- see the module doc comment. Only include
        // a key when the admin actually touched the fields that govern it;
        // omitting it leaves the server's current value unchanged.
        const dirty = form.formState.dirtyFields;
        const recurrenceDirty = Boolean(
          dirty.repeat ||
          dirty.recurrenceFreq ||
          dirty.recurrenceInterval ||
          dirty.recurrenceEndType ||
          dirty.recurrenceUntil ||
          dirty.recurrenceCount ||
          dirty.recurrenceByday
        );

        const result = await updateBlock({
          groupId,
          slotId,
          blockId: block.id,
          body: {
            start_time: startISO,
            end_time: endISO,
            timezone: values.timezone,
            ...(dirty.reason ? { reason: values.reason ?? '' } : {}),
            ...(recurrenceDirty
              ? {
                  rrule_string: values.repeat
                    ? serializeRRule(buildRecurrenceRule(values))
                    : null,
                }
              : {}),
          },
        });
        toast.success('Blocked time updated');
        onSaved?.({
          orphanedBookings: result.orphanedBookings.map((booking) => ({
            ...booking,
            timezone: values.timezone,
          })),
        });
      } else {
        const result = await createBlock({
          groupId,
          slotId,
          body: {
            calendar: calendarId,
            start_time: startISO,
            end_time: endISO,
            timezone: values.timezone,
            ...(values.reason ? { reason: values.reason } : {}),
            ...(values.repeat
              ? { rrule_string: serializeRRule(buildRecurrenceRule(values)) }
              : {}),
          },
        });
        toast.success('Blocked time created');
        onSaved?.({
          orphanedBookings: result.orphanedBookings.map((booking) => ({
            ...booking,
            timezone: values.timezone,
          })),
        });
      }
    } catch (err) {
      const overLimit = readOverLimitError(err);
      if (overLimit) {
        // Rendered inline, editor's input kept intact -- see the module doc
        // comment on why this doesn't bubble up like the orphan case does.
        setOverLimitError(overLimit);
      } else {
        toast.error(
          isEdit
            ? 'Failed to update blocked time'
            : 'Failed to create blocked time',
          {
            description: getApiErrorMessage(err, 'Unknown error'),
          }
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Form {...form}>
      <FormLayout gap={4} onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Stack gap={4}>
          <FormField
            control={form.control}
            name='date'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type='date' {...field} disabled={isSaving} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <HStack gap={3}>
            <Box grow basis={0}>
              <FormField
                control={form.control}
                name='startTime'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start time</FormLabel>
                    <FormControl>
                      <Input type='time' {...field} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Box>
            <Text size='sm' color='muted-foreground' pt={6}>
              –
            </Text>
            <Box grow basis={0}>
              <FormField
                control={form.control}
                name='endTime'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End time</FormLabel>
                    <FormControl>
                      <Input type='time' {...field} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Box>
          </HStack>

          <FormField
            control={form.control}
            name='timezone'
            render={({ field }) => {
              // A loaded block's timezone (e.g. a pre-existing "UTC") can be
              // valid without being a literal member of
              // `Intl.supportedValuesOf('timeZone')` -- same guard as
              // group-window-grid.tsx's timezone field, so an already-
              // configured zone isn't silently blanked by Radix's Select.
              const timeZoneOptions =
                field.value && !TIME_ZONES.includes(field.value)
                  ? [field.value, ...TIME_ZONES]
                  : TIME_ZONES;
              return (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSaving}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select a timezone' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {timeZoneOptions.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name='reason'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason (optional)</FormLabel>
                <FormControl>
                  <Input
                    type='text'
                    placeholder='e.g., Conference, Out of office'
                    {...field}
                    disabled={isSaving}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Stack>

        <FormField
          control={form.control}
          name='repeat'
          render={({ field }) => (
            <FormItem>
              <HStack justify='between' p={3} border radius='lg'>
                <FormLabel>Repeat this block</FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      // Turning Repeat off explicitly clears rrule_string
                      // (tri-state PATCH, see onSubmit) -- that's the
                      // "clear" half of the classify-and-refuse gate above.
                      // Unlock so turning it back on lets the admin compose
                      // a brand-new rule instead of staying stuck on the
                      // unrepresentable one.
                      if (!checked && recurrenceLocked) {
                        setRecurrenceLocked(false);
                      }
                    }}
                    disabled={isSaving}
                  />
                </FormControl>
              </HStack>
            </FormItem>
          )}
        />

        {repeat && (
          <>
            <Divider />
            <RecurrenceFields
              form={form}
              disabled={isSaving}
              locked={recurrenceLocked}
            />
          </>
        )}

        {overLimitError && (
          <OverLimitAlert error={overLimitError} otherWritesSucceeded={0} />
        )}

        <HStack gap={3} justify='end'>
          {onCancel && (
            <Button
              type='button'
              variant='outline'
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          )}
          <Button
            type='submit'
            disabled={isSaving}
            data-testid='group-block-submit'
          >
            {isSaving
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save changes'
                : 'Add block'}
          </Button>
        </HStack>
      </FormLayout>
    </Form>
  );
}
