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
  VisuallyHidden,
} from 'vinta-schedule-design-system/layout';
import { weekdayMatrix, type WeekdayEntry } from '@/lib/datetime/index';
import { useGroupScopedWindows } from '@/hooks/calendar-groups/use-group-scoped-windows';
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
  timezone: z.string().min(1, { message: 'Timezone is required' }),
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
                    <Text key={i} size='sm' color='muted-foreground'>
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

export function GroupWindowGrid({
  groupId,
  slotId,
  calendarId,
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

  const hasHydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (hasHydratedRef.current) return;
    if (isLoading) return;
    hasHydratedRef.current = true;
    const timezone = defaultGridTimezone(windows, viewerTimezone);
    form.reset(buildDefaultsFromRepresentable(representable, timezone));
    setLoadedBaseline(representable);
    // hasHydratedRef makes this a one-shot effect; the dep list only needs
    // to observe when loading finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const weekdays = weekdayMatrix();

  async function onSubmit(values: GridFormSchema) {
    // Guards a literal double-submit: `isSaving` is captured in this
    // closure at the render that created it, and the Save button is
    // disabled from the very next render onward -- see the Save button's
    // `disabled={isSaving}` below.
    if (isSaving) return;

    const edited: EditedRow[] = [];
    values.weekdays.forEach((row, weekdayIndex) => {
      row.ranges.forEach((range, rangeIndex) => {
        if (!range.startTime || !range.endTime) return;
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
      toast.info('No changes to save');
      return;
    }

    setIsSaving(true);
    try {
      await Promise.all([
        ...diff.creates.map(async (row) => {
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
        }),
        ...diff.updates.map(async (update) => {
          // The row keeps its OWN original timezone -- an edit to the
          // wall-clock time must not also silently re-zone it.
          const original = windows.find((w) => w.id === update.id);
          const timezone = original?.timezone ?? values.timezone;
          await updateWindow({
            groupId,
            slotId,
            windowId: update.id,
            body: buildWindowUpdateBody(update.row, timezone),
          });
        }),
        ...diff.deletes.map((id) =>
          deleteWindow({ groupId, slotId, windowId: id })
        ),
      ]);

      // Every diffed write succeeded: the edited state now matches the
      // server, so it becomes the new baseline for the next save.
      setLoadedBaseline(edited.map(toWeekdayWindow));
      toast.success('Availability windows saved', {
        description: `${edited.length} weekly window${edited.length === 1 ? '' : 's'} saved.`,
      });
    } catch (err) {
      toast.error('Failed to save availability windows', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  }

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
      <FormLayout gap={4} onSubmit={form.handleSubmit(onSubmit)}>
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
          render={({ field }) => (
            <FormItem>
              <FormLabel>Timezone</FormLabel>
              <FormControl>
                <Input
                  type='text'
                  {...field}
                  disabled={isSaving}
                  aria-label='Timezone for new or edited windows'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
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
