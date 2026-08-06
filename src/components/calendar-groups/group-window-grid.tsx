'use client';

/**
 * GroupWindowGrid — the weekday grid editor for one calendar's group-scoped
 * availability windows in one slot (Phase 3b).
 *
 * Shape follows availability-editor.tsx: seven weekday rows (Mon-Sun), each
 * with zero or more start/end time ranges. Unlike the base-availability
 * editor, saving here is DIFF-based, not full-replace: `computeGridDiff`
 * (group-scoped-types.ts) compares the edited rows against the rows the
 * grid was loaded with and issues only the resulting creates, updates, and
 * deletes through Phase 3a's `useGroupScopedWindows` hook. An unchanged
 * grid issues zero requests.
 *
 * ONLY rows `classifyWindows` marks representable ever enter this
 * component's form state or diff baseline -- everything else
 * (one-offs, multi-day BYDAY, non-weekly, unparseable) is rendered by
 * unsupported-window-list.tsx instead, and is structurally unreachable from
 * this component's save handler (see group-scoped-types.test.ts).
 *
 * Timezone: a single grid-level selector, defaulting to the calendar's own
 * already-configured timezone (read from its existing group-scoped rows --
 * `Calendar` itself carries no timezone field) or the viewer's local zone
 * when the calendar has none yet. Changing the selector alone (with no
 * other edit) does not rewrite any already-loaded row -- only rows that are
 * genuinely added or edited pick up the selector's current value. A row's
 * PATCH always keeps ITS OWN original timezone (see
 * buildWindowUpdateBody's doc comment), so nothing is silently re-zoned.
 */

import * as React from 'react';
import { useForm, useFieldArray, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Skeleton } from 'vinta-schedule-design-system/ui/skeleton';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from 'vinta-schedule-design-system/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'vinta-schedule-design-system/ui/select';
import {
  Box,
  Divider,
  FormLayout,
  HStack,
  Stack,
  Text,
  VStack,
  VisuallyHidden,
} from 'vinta-schedule-design-system/layout';
import {
  DateTime,
  weekdayMatrix,
  type WeekdayEntry,
} from '@/lib/datetime/index';
import { useGroupScopedWindows } from '@/hooks/calendar-groups/use-group-scoped-windows';
import {
  readOverLimitError,
  isNotFoundError,
  type OverLimitErrorBody,
} from '@/lib/utils/api-errors';
import { useCanEditCalendar } from './group-permissions-provider';
import {
  classifyWindows,
  computeGridDiff,
  buildWindowCreateBody,
  buildWindowUpdateBody,
  defaultGridTimezone,
  BYDAY_TO_INDEX,
  type WeekdayWindow,
  type BydayCode,
} from './group-scoped-types';
import {
  OrphanedBookingsAlert,
  type OrphanedBooking,
} from './orphaned-bookings-alert';
import { OverLimitAlert } from './over-limit-alert';

// All IANA zone names the runtime's ICU data knows about, for the timezone
// Select below -- replaces a free-text input a typo could turn into an
// invalid zone (see the `.refine` on `gridFormSchema.timezone`).
const TIME_ZONES = Intl.supportedValuesOf('timeZone');

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const rangeSchema = z
  .object({
    // The server row id this range was loaded from -- absent for a range
    // the editor added and has not saved yet. Never rendered; carried only
    // so onSubmit can rebuild WeekdayWindow rows for computeGridDiff.
    sourceId: z.number().optional(),
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

const weekdayRowSchema = z.object({
  ranges: z.array(rangeSchema),
});

const gridFormSchema = z.object({
  timezone: z
    .string()
    .min(1, { message: 'Timezone is required' })
    .refine((tz) => DateTime.local().setZone(tz).isValid, {
      message: 'Unknown timezone',
    }),
  weekdays: z.array(weekdayRowSchema),
});

type GridFormSchema = z.infer<typeof gridFormSchema>;

function makeDefaultValues(timezone: string): GridFormSchema {
  return {
    timezone,
    weekdays: weekdayMatrix().map(() => ({ ranges: [] })),
  };
}

function buildDefaultsFromRepresentable(
  rows: readonly WeekdayWindow[],
  timezone: string
): GridFormSchema {
  const defaults = makeDefaultValues(timezone);
  for (const row of rows) {
    const idx = BYDAY_TO_INDEX[row.weekday];
    if (idx === undefined) continue;
    defaults.weekdays[idx].ranges.push({
      sourceId: row.id,
      startTime: row.startTime,
      endTime: row.endTime,
    });
  }
  return defaults;
}

// ---------------------------------------------------------------------------
// WeekdayRow
// ---------------------------------------------------------------------------

interface WeekdayRowProps {
  weekday: WeekdayEntry;
  weekdayIndex: number;
  form: UseFormReturn<GridFormSchema>;
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
      <HStack gap={3} align='start'>
        <Text
          size='sm'
          weight='medium'
          width={40}
          shrink={0}
          pt={2}
          color='foreground'
        >
          {weekday.short}
        </Text>
        <Stack gap={2} grow basis={0}>
          {fields.length === 0 ? (
            <Text size='sm' color='muted-foreground' py={2}>
              No availability set
            </Text>
          ) : (
            fields.map((field, rangeIdx) => (
              <HStack key={field.id} gap={2} align='start'>
                <Box grow basis={0}>
                  <FormField
                    control={form.control}
                    name={`weekdays.${weekdayIndex}.ranges.${rangeIdx}.startTime`}
                    render={({ field: f }) => (
                      <FormItem>
                        <VisuallyHidden as={FormLabel}>
                          Start time
                        </VisuallyHidden>
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
                </Box>
                <Text size='sm' color='muted-foreground' pt={2}>
                  –
                </Text>
                <Box grow basis={0}>
                  <FormField
                    control={form.control}
                    name={`weekdays.${weekdayIndex}.ranges.${rangeIdx}.endTime`}
                    render={({ field: f }) => (
                      <FormItem>
                        <VisuallyHidden as={FormLabel}>End time</VisuallyHidden>
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
                </Box>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={() => remove(rangeIdx)}
                  disabled={disabled}
                  aria-label={`Remove ${weekday.label} window ${rangeIdx + 1}`}
                >
                  <Trash2 />
                </Button>
              </HStack>
            ))
          )}
          <HStack>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => append({ startTime: '09:00', endTime: '17:00' })}
              disabled={disabled}
              aria-label={`Add ${weekday.label} window`}
            >
              <Plus />
              Add
            </Button>
          </HStack>
        </Stack>
      </HStack>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Read-only rendering
// ---------------------------------------------------------------------------

function ReadOnlyGrid({
  representable,
  isTruncated,
}: {
  representable: readonly WeekdayWindow[];
  isTruncated: boolean;
}) {
  const weekdays = weekdayMatrix();
  return (
    <VStack gap={3}>
      <Text size='sm' weight='medium' color='foreground'>
        Weekly availability
      </Text>
      {isTruncated && (
        <Text size='xs' color='warning'>
          This calendar has more windows in this slot than can be loaded at once
          -- some rows may not be shown below.
        </Text>
      )}
      {representable.length === 0 ? (
        <Text size='sm' color='muted-foreground'>
          No weekly windows configured.
        </Text>
      ) : (
        <Stack gap={2}>
          {weekdays.map((weekday) => {
            const rows = representable.filter(
              (r) => r.weekday === weekday.byday
            );
            if (rows.length === 0) return null;
            return (
              <HStack key={weekday.byday} gap={3} align='start'>
                <Text size='sm' weight='medium' width={40} shrink={0}>
                  {weekday.short}
                </Text>
                <Stack gap={1}>
                  {rows.map((row, i) => (
                    <Text key={row.id ?? i} size='sm' color='muted-foreground'>
                      {row.startTime}–{row.endTime}
                    </Text>
                  ))}
                </Stack>
              </HStack>
            );
          })}
        </Stack>
      )}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface GroupWindowGridProps {
  groupId: number;
  slotId: number;
  calendarId: number;
  /** Display name of `calendarId`'s calendar -- forwarded to OrphanedBookingsAlert. */
  calendarName?: string;
}

// Extra bookkeeping GroupWindowGrid attaches to each edited row so a
// successful create can write the server-assigned id back into the exact
// form field it came from (see onSubmit). computeGridDiff is generic over
// this shape and returns it untouched in `creates`/`updates[].row`.
interface EditedRow extends WeekdayWindow {
  weekdayIndex: number;
  rangeIndex: number;
}

function toWeekdayWindow(row: EditedRow): WeekdayWindow {
  return {
    id: row.id,
    weekday: row.weekday,
    startTime: row.startTime,
    endTime: row.endTime,
  };
}

// The outcome of one diffed write, tagged so onSubmit can fold only the
// SUCCEEDED writes back into the diff baseline after a `Promise.allSettled`
// (see the BLOCKER 2 comment in onSubmit for why this can't be `Promise.all`).
//
// 'update-gone' is a FULFILLED outcome, not a rejection: onSubmit catches a
// 404 (isNotFoundError) on the update call itself and folds it into this
// shape, the same convention useGroupScopedWindows.deleteWindow already
// uses for its own 'row_gone' -- "the row is confirmed absent server-side"
// is a real, actionable answer, not a transport failure. Carries
// weekdayIndex/rangeIndex so onSubmit can clear the form field's stale
// sourceId (see the reconciliation loop).
type WriteOutcome =
  | {
      type: 'create' | 'update';
      row: WeekdayWindow;
      orphanedBookings: OrphanedBooking[];
    }
  | {
      type: 'update-gone';
      id: number;
      weekdayIndex: number;
      rangeIndex: number;
    }
  | { type: 'delete'; id: number };

export function GroupWindowGrid({
  groupId,
  slotId,
  calendarId,
  calendarName,
}: GroupWindowGridProps) {
  // Read-only-ness comes from the shared GroupPermissionsProvider context
  // (mounted by the group detail page), the same predicate every roster row
  // and editor in this feature consumes -- see group-permissions.ts.
  const readOnly = !useCanEditCalendar(calendarId);

  const viewerTimezone =
    typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';

  const {
    windows,
    isLoading,
    isTruncated,
    createWindow,
    updateWindow,
    deleteWindow,
    windowsQuery,
  } = useGroupScopedWindows({ groupId, slotId, calendarId });

  const { representable } = React.useMemo(
    () => classifyWindows(windows),
    [windows]
  );

  const form = useForm<GridFormSchema>({
    resolver: zodResolver(gridFormSchema),
    defaultValues: makeDefaultValues(viewerTimezone),
  });

  // The rows the grid was last loaded/saved with -- the diff baseline.
  // Updated after a successful save so re-saving with no further edits
  // issues nothing (idempotent re-save).
  const [loadedBaseline, setLoadedBaseline] = React.useState<WeekdayWindow[]>(
    []
  );
  const [isSaving, setIsSaving] = React.useState(false);
  // Guards against a literal double-submit synchronously: two calls to
  // onSubmit reaching the handler before React re-renders (which is what
  // disables the Save button via `disabled={isSaving}`) would both read
  // `isSaving` as stale `false` if this were state. A ref is read-and-set
  // synchronously, so the second call sees the first's write immediately.
  const savingRef = React.useRef(false);
  // Bumped every time the effect below hydrates the form, and used as the
  // timezone Select's `key`. Radix's Select mirrors its controlled `value`
  // into a hidden native `<select>` for form semantics; if that value
  // changes AFTER mount while the dropdown has never been opened, the
  // native mirror has no matching `<option>` yet and Radix resets the
  // value to '' via `onValueChange` (see SelectBubbleInput in
  // @radix-ui/react-select) -- silently blanking the timezone `form.reset`
  // just set. Changing `key` forces a fresh Select instance whose value is
  // correct from its own first render instead of being changed out from
  // under it.
  const [hydrationGeneration, setHydrationGeneration] = React.useState(0);

  // Bookings a save orphaned (spec UC-5) -- collected across every write in
  // ONE save (see onSubmit) and cleared at the start of the next one, so the
  // alert always reflects the most recent save attempt, not a stale one.
  const [orphanedBookings, setOrphanedBookings] = React.useState<
    OrphanedBooking[]
  >([]);
  // Set when a write in the most recent save was rejected as over-limit
  // (spec UC-6). `otherWritesSucceeded` counts the OTHER writes in that same
  // batch that already landed -- see over-limit-alert.tsx's doc comment for
  // why that matters. Cleared at the start of the next save attempt.
  const [overLimitError, setOverLimitError] = React.useState<{
    error: OverLimitErrorBody;
    otherWritesSucceeded: number;
  } | null>(null);

  // Re-hydrates the form from the server's `windows` whenever they change
  // (initial load, or a refetch after ANY write invalidates the list query
  // -- including another admin's concurrent edit or a server-normalized
  // value), as long as the form has no unsaved edits of its own. Guarding
  // on `isDirty` (read, not a dependency) rather than gating with a
  // one-shot ref lets a later, quiet refetch still reach the form -- see
  // the Guiding Decision "writes refetch; no optimistic updates".
  React.useEffect(() => {
    if (isLoading) return;
    if (form.formState.isDirty) return;
    const timezone = defaultGridTimezone(windows, viewerTimezone);
    form.reset(buildDefaultsFromRepresentable(representable, timezone));
    setLoadedBaseline(representable);
    setHydrationGeneration((generation) => generation + 1);
    // `form` and `viewerTimezone` are stable across renders; `representable`
    // is derived from `windows` via useMemo, so depending on `windows` alone
    // is sufficient to react to every server-data change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, windows]);

  const weekdays = weekdayMatrix();

  // `form.handleSubmit(onSubmit)` below calls `onSubmit` (indirectly) during
  // render to produce the submit handler; `react-hooks/refs` flags a plain
  // function that reads `savingRef.current` there as an in-render ref read.
  // Wrapping it in `useCallback` satisfies the rule -- it's a genuine
  // memoized callback, not a render-time ref access, even though several of
  // its dependencies (createWindow/updateWindow/deleteWindow, `weekdays`)
  // are re-created every render, so this doesn't skip re-creation in
  // practice.
  const onSubmit = React.useCallback(
    async (values: GridFormSchema) => {
      // Synchronous double-submit guard -- see savingRef's doc comment above.
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        const edited: EditedRow[] = [];
        values.weekdays.forEach((row, weekdayIndex) => {
          row.ranges.forEach((range, rangeIndex) => {
            edited.push({
              id: range.sourceId,
              weekday: weekdays[weekdayIndex].byday as BydayCode,
              startTime: range.startTime,
              endTime: range.endTime,
              weekdayIndex,
              rangeIndex,
            });
          });
        });

        const diff = computeGridDiff(loadedBaseline, edited);

        if (
          diff.creates.length === 0 &&
          diff.updates.length === 0 &&
          diff.deletes.length === 0
        ) {
          // A timezone-only edit never produces a create/update/delete (see
          // buildWindowUpdateBody's doc comment -- an edited row keeps its own
          // original zone; only NEW rows pick up the selector). Say so
          // explicitly rather than the generic message, which would otherwise
          // read as "your edit did nothing" with no explanation.
          toast.info(
            form.formState.dirtyFields.timezone
              ? 'Timezone applies to new windows only — nothing to save.'
              : 'No changes to save'
          );
          // A prior save's alert must not linger once there's nothing left
          // to retry -- reachable when the admin reverts the edit that
          // caused it and clicks Save again.
          setOrphanedBookings([]);
          setOverLimitError(null);
          return;
        }

        setIsSaving(true);
        // Clear the previous save's alerts up front so this attempt's
        // outcome is what's on screen -- a stale over-limit or orphan alert
        // from an earlier save must not linger across a later, unrelated one.
        setOrphanedBookings([]);
        setOverLimitError(null);
        try {
          const outcomes = await Promise.allSettled<WriteOutcome>([
            ...diff.creates.map(async (row): Promise<WriteOutcome> => {
              const result = await createWindow({
                groupId,
                slotId,
                body: buildWindowCreateBody(row, calendarId, values.timezone),
              });
              // Reattach the server id so an immediate re-save (no further
              // edits) diffs against a real id instead of re-creating it.
              row.id = result.window.id;
              form.setValue(
                `weekdays.${row.weekdayIndex}.ranges.${row.rangeIndex}.sourceId`,
                result.window.id,
                { shouldDirty: false }
              );
              return {
                type: 'create',
                row: toWeekdayWindow(row),
                // The zone this write's own body was sent in -- an orphaned
                // booking has none of its own (see OrphanedBooking's doc
                // comment), so the write that stranded it is the only
                // correct source.
                orphanedBookings: result.orphanedBookings.map((booking) => ({
                  ...booking,
                  timezone: values.timezone,
                })),
              };
            }),
            ...diff.updates.map(async (update): Promise<WriteOutcome> => {
              // The row keeps its OWN original timezone -- an edit to the
              // wall-clock time must not also silently re-zone it.
              const original = windows.find((w) => w.id === update.id);
              const timezone = original?.timezone ?? values.timezone;
              try {
                const result = await updateWindow({
                  groupId,
                  slotId,
                  windowId: update.id,
                  body: buildWindowUpdateBody(update.row, timezone),
                });
                return {
                  type: 'update',
                  row: toWeekdayWindow(update.row),
                  // Same reasoning as the create branch above, but this
                  // write's body used the row's OWN original zone, not the
                  // selector's -- `timezone` here already reflects that.
                  orphanedBookings: result.orphanedBookings.map((booking) => ({
                    ...booking,
                    timezone,
                  })),
                };
              } catch (err) {
                // Someone else deleted this row between load and save --
                // confirmed absent, not a transport failure. Fold it into a
                // fulfilled outcome (same convention deleteWindow's own
                // 'row_gone' uses) rather than letting it read as an
                // ordinary write failure.
                if (isNotFoundError(err)) {
                  return {
                    type: 'update-gone',
                    id: update.id,
                    weekdayIndex: update.row.weekdayIndex,
                    rangeIndex: update.row.rangeIndex,
                  };
                }
                throw err;
              }
            }),
            ...diff.deletes.map(async (id): Promise<WriteOutcome> => {
              await deleteWindow({ groupId, slotId, windowId: id });
              return { type: 'delete', id };
            }),
          ]);

          // BLOCKER 2 fix: reconcile the baseline from ONLY the writes that
          // actually succeeded. `Promise.all` used to reject on the first
          // failure and skip this step entirely -- but a create that already
          // succeeded had already written its server id into the form
          // (above), so on retry `computeGridDiff` saw an id `loadedBaseline`
          // didn't recognize and re-created it. Starting from the previous
          // baseline and applying only the successful outcomes means a retry
          // always re-diffs against what the server actually has, however
          // many writes in this batch failed.
          const baselineById = new Map<number, WeekdayWindow>(
            loadedBaseline
              .filter(
                (row): row is WeekdayWindow & { id: number } =>
                  row.id !== undefined
              )
              .map((row) => [row.id, row])
          );
          const orphaned: OrphanedBooking[] = [];
          let goneCount = 0;
          for (const outcome of outcomes) {
            if (outcome.status !== 'fulfilled') continue;
            const value = outcome.value;
            if (value.type === 'delete') {
              baselineById.delete(value.id);
            } else if (value.type === 'update-gone') {
              // Confirmed gone server-side -- drop it from the baseline AND
              // clear the form's now-stale sourceId, so a later save treats
              // this row as a fresh create instead of PATCHing an id that no
              // longer exists (same "fail toward create" direction
              // computeGridDiff already takes for an id it doesn't
              // recognize).
              baselineById.delete(value.id);
              goneCount += 1;
              form.setValue(
                `weekdays.${value.weekdayIndex}.ranges.${value.rangeIndex}.sourceId`,
                undefined,
                { shouldDirty: false }
              );
            } else {
              if (value.row.id !== undefined) {
                baselineById.set(value.row.id, value.row);
              }
              orphaned.push(...value.orphanedBookings);
            }
          }
          setLoadedBaseline(Array.from(baselineById.values()));
          setOrphanedBookings(orphaned);

          const failures = outcomes.filter(
            (outcome): outcome is PromiseRejectedResult =>
              outcome.status === 'rejected'
          );
          const overLimit = failures
            .map((failure) => readOverLimitError(failure.reason))
            .find((body): body is OverLimitErrorBody => body !== null);
          // Failures the over-limit alert does NOT speak for -- a mixed
          // batch (e.g. an over-limit rejection on one row and an unrelated
          // 500 on another) must not let the ordinary failure go unreported
          // just because `overLimit` is truthy.
          const nonOverLimitFailures = failures.filter(
            (failure) => readOverLimitError(failure.reason) === null
          );

          if (overLimit) {
            // Some of THIS SAME batch's other writes may already have
            // reached the server (Promise.allSettled, not Promise.all) --
            // count them so the alert doesn't claim nothing was written when
            // something was. See over-limit-alert.tsx's doc comment.
            const otherWritesSucceeded = outcomes.filter(
              (outcome) =>
                outcome.status === 'fulfilled' &&
                (outcome.value.type === 'create' ||
                  outcome.value.type === 'update' ||
                  outcome.value.type === 'delete')
            ).length;
            setOverLimitError({ error: overLimit, otherWritesSucceeded });
            if (nonOverLimitFailures.length > 0) {
              const firstReason = nonOverLimitFailures[0].reason;
              toast.error('Failed to save some availability windows', {
                description: `${nonOverLimitFailures.length} of ${outcomes.length} write${outcomes.length === 1 ? '' : 's'} failed${firstReason instanceof Error ? `: ${firstReason.message}` : ''}. Already-saved changes were kept -- retry to finish the rest.`,
              });
            }
          } else if (failures.length > 0) {
            const firstReason = failures[0].reason;
            toast.error('Failed to save availability windows', {
              description: `${failures.length} of ${outcomes.length} write${outcomes.length === 1 ? '' : 's'} failed${firstReason instanceof Error ? `: ${firstReason.message}` : ''}. Already-saved changes were kept -- retry to finish the rest.`,
            });
          } else {
            toast.success('Availability windows saved', {
              description: `${edited.length} weekly window${edited.length === 1 ? '' : 's'} saved.`,
            });
          }

          if (goneCount > 0) {
            toast.info(
              goneCount === 1
                ? 'This entry no longer exists'
                : 'Some entries no longer exist',
              {
                description:
                  'They may have already been removed elsewhere. Reloading the latest data.',
              }
            );
            void windowsQuery.refetch();
          }
        } finally {
          setIsSaving(false);
        }
      } finally {
        savingRef.current = false;
      }
    },
    [
      weekdays,
      loadedBaseline,
      form,
      groupId,
      slotId,
      calendarId,
      createWindow,
      updateWindow,
      deleteWindow,
      windows,
      windowsQuery,
    ]
  );

  // `form.handleSubmit(onSubmit)` (RHF's usual inline JSX call) would invoke
  // `handleSubmit` during render to build the event handler, which is what
  // `react-hooks/refs` actually objects to here (onSubmit closes over
  // savingRef) -- not the ref read itself. Deferring the call into a
  // handler that only runs at submit time avoids invoking it during render.
  const handleFormSubmit = React.useCallback(
    (event: React.BaseSyntheticEvent) => form.handleSubmit(onSubmit)(event),
    [form, onSubmit]
  );

  if (isLoading) {
    return (
      <Stack gap={3} aria-label='Loading availability windows'>
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} height={32} width='full' radius='md' />
        ))}
      </Stack>
    );
  }

  if (readOnly) {
    return (
      <ReadOnlyGrid representable={representable} isTruncated={isTruncated} />
    );
  }

  return (
    <Form {...form}>
      <FormLayout gap={4} onSubmit={handleFormSubmit}>
        <Text size='sm' weight='medium' color='foreground'>
          Weekly availability
        </Text>
        {isTruncated && (
          <Text size='xs' color='warning'>
            This calendar has more windows in this slot than can be loaded at
            once -- some existing rows may not be represented in this grid or
            the read-only list below.
          </Text>
        )}

        <FormField
          control={form.control}
          name='timezone'
          render={({ field }) => {
            // A loaded row's timezone (e.g. a pre-existing "UTC") can be a
            // perfectly valid zone without being a literal member of
            // `Intl.supportedValuesOf('timeZone')` (that list uses
            // canonical IANA names, e.g. "Etc/UTC"). Radix's Select resets
            // an unmatched controlled `value` to '' via `onValueChange`, so
            // without this the calendar's already-configured timezone would
            // be silently blanked on load. Always give the current value a
            // matching item.
            const timeZoneOptions =
              field.value && !TIME_ZONES.includes(field.value)
                ? [field.value, ...TIME_ZONES]
                : TIME_ZONES;
            return (
              <FormItem>
                <FormLabel>Timezone</FormLabel>
                <Select
                  key={hydrationGeneration}
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
                {/* Only NEW rows pick up this value on save -- an edited
                    row's PATCH always keeps its own original timezone (see
                    buildWindowUpdateBody's doc comment). Naming that here
                    rather than in a stale aria-label keeps the accessible
                    name equal to the visible FormLabel. */}
                <FormDescription>
                  Applies only to windows you add here; existing windows keep
                  their own timezone.
                </FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <Stack gap={3}>
          {weekdays.map((weekday, idx) => (
            <React.Fragment key={weekday.byday}>
              <WeekdayRow
                weekday={weekday}
                weekdayIndex={idx}
                form={form}
                disabled={isSaving}
              />
              {idx < weekdays.length - 1 && <Divider spacing={1} />}
            </React.Fragment>
          ))}
        </Stack>

        {/* Results of the most recent save (spec UC-5/UC-6). Neither alert
            resets the form or the rows above -- see the doc comments on
            OrphanedBookingsAlert/OverLimitAlert and onSubmit's reconciliation
            for why leaving edited state intact is deliberate here. */}
        {overLimitError && (
          <OverLimitAlert
            error={overLimitError.error}
            otherWritesSucceeded={overLimitError.otherWritesSucceeded}
          />
        )}
        {orphanedBookings.length > 0 && (
          <OrphanedBookingsAlert
            bookings={orphanedBookings}
            calendarName={calendarName}
            onDismiss={() => setOrphanedBookings([])}
          />
        )}

        <HStack gap={3} justify='end'>
          <Button
            type='button'
            variant='outline'
            onClick={() =>
              form.reset(
                buildDefaultsFromRepresentable(
                  loadedBaseline,
                  form.getValues('timezone')
                )
              )
            }
            disabled={isSaving}
          >
            Reset
          </Button>
          <Button type='submit' disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save windows'}
          </Button>
        </HStack>
      </FormLayout>
    </Form>
  );
}
