'use client';

/**
 * GroupFormDialog — build or edit a Calendar Group, shared by the create and
 * edit entry points.
 *
 * A slot's bookable roster is the **union** of two sources: the calendars
 * picked individually on the slot, and the calendars of every pool attached to
 * it. Either source alone is enough; a calendar in both counts once. So the
 * form validates `required_count` and the "roster is not empty" rule against
 * that union, not against the individual picks alone.
 *
 * Fields:
 *   - name (required)
 *   - description (optional)
 *   - slots (useFieldArray, ≥1 slot required)
 *       - name (required)
 *       - required_count (≥1, must not exceed the effective roster size)
 *       - pool_ids (calendar pools attached to the slot)
 *       - calendar_ids (calendars picked individually for this slot)
 *
 * Two API behaviors shape the edit mode:
 *
 *   - **Slots are matched by name.** Any saved slot name the payload no longer
 *     carries is removed, which drops that slot's group-scoped availability
 *     windows, blocked time, and quota rules — and is refused outright while
 *     the slot has future bookings. Renaming a slot lands in exactly that
 *     branch, since a new name is indistinguishable from a new slot. The form
 *     names the slots it is about to drop before submit, rather than letting
 *     the user discover the loss from a 400 (or from silence).
 *   - **`pool_ids` is omit-means-unchanged.** This form always sends it, for
 *     every slot, so a renamed slot (which the API treats as new, where an
 *     omitted `pool_ids` means "no pools") keeps the pools shown in the form.
 *
 * Removing a calendar from a roster is never refused and never touches
 * appointments already booked — they keep the calendars they hold. Removing a
 * whole slot still is refused while it has future bookings; that rejection
 * arrives as a form-level message.
 */

import * as React from 'react';
import { useForm, useFieldArray, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from 'vinta-schedule-design-system/ui/dialog';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Combobox } from 'vinta-schedule-design-system/ui/combobox';
import { Label } from 'vinta-schedule-design-system/ui/label';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormRootMessage,
} from 'vinta-schedule-design-system/ui/form';
import {
  FormLayout,
  VStack,
  HStack,
  Text,
} from 'vinta-schedule-design-system/layout';
import type { Calendar, CalendarGroup } from '@/client';
import { useAllCalendars } from '@/hooks/calendars/use-all-calendars';
import {
  useAllCalendarPools,
  type CalendarPool,
} from '@/hooks/calendar-pools/use-calendar-pools';
import { useCreateCalendarGroup } from '@/hooks/calendar-groups/use-create-calendar-group';
import { useUpdateCalendarGroup } from '@/hooks/calendar-groups/use-update-calendar-group';
import { handleMutationError } from '@/lib/utils/form-errors';

/** One page wide enough to offer every calendar an org realistically has. */
const CALENDARS_PAGE_SIZE = 200;

// ---------------------------------------------------------------------------
// Roster resolution
// ---------------------------------------------------------------------------

/** Pool id → the calendar ids on that pool's roster. */
export type PoolRosters = ReadonlyMap<number, readonly number[]>;

export function buildPoolRosters(pools: readonly CalendarPool[]): PoolRosters {
  return new Map(pools.map((p) => [p.id, p.calendars.map((c) => c.id)]));
}

/**
 * The calendars a slot actually offers: its individual picks plus every
 * attached pool's roster, deduplicated. A pool id with no entry in `rosters`
 * contributes nothing — that happens only while the pool list is still
 * loading, and the form blocks submit until it has resolved.
 */
export function effectiveRoster(
  calendarIds: readonly number[],
  poolIds: readonly number[],
  rosters: PoolRosters
): number[] {
  const union = new Set<number>(calendarIds);
  for (const poolId of poolIds) {
    for (const calendarId of rosters.get(poolId) ?? []) {
      union.add(calendarId);
    }
  }
  return [...union];
}

/**
 * Splits a saved slot's roster back into the two form inputs.
 *
 * The API reports a slot's roster as one flat `calendars` list with no marker
 * for where each calendar came from, so "individual" is derived by subtracting
 * the attached pools' rosters. A calendar that is BOTH an individual pick and a
 * pool member therefore comes back as pool-only. That is invisible until the
 * pool is later detached, at which point the calendar leaves the slot where
 * before it would have stayed — the API has no way to express the distinction
 * on read, so the form cannot preserve it.
 */
export function splitSavedSlotRoster(
  calendars: readonly Calendar[],
  pools: readonly CalendarPool[]
): { calendar_ids: number[]; pool_ids: number[] } {
  const fromPools = new Set(pools.flatMap((p) => p.calendars.map((c) => c.id)));
  return {
    calendar_ids: calendars.map((c) => c.id).filter((id) => !fromPools.has(id)),
    pool_ids: pools.map((p) => p.id),
  };
}

// ---------------------------------------------------------------------------
// Zod schema
//
// Built as a factory because the cross-field rules need the pool rosters, which
// are fetched at runtime rather than known statically.
// ---------------------------------------------------------------------------

export function createGroupFormSchema(rosters: PoolRosters) {
  const slotSchema = z
    .object({
      name: z.string().trim().min(1, { message: 'Slot name is required' }),
      required_count: z
        .number({ error: 'Required count must be a number' })
        .int()
        .min(1, { message: 'Required count must be at least 1' }),
      calendar_ids: z.array(z.number()),
      pool_ids: z.array(z.number()),
    })
    .superRefine((data, ctx) => {
      const roster = effectiveRoster(data.calendar_ids, data.pool_ids, rosters);
      if (roster.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Add at least one calendar or pool to this slot',
          path: ['calendar_ids'],
        });
        return;
      }
      if (data.required_count > roster.length) {
        ctx.addIssue({
          code: 'custom',
          message: `Required count cannot exceed the roster size (${roster.length})`,
          path: ['required_count'],
        });
      }
    });

  return z.object({
    name: z.string().trim().min(1, { message: 'Group name is required' }),
    description: z.string().optional(),
    slots: z
      .array(slotSchema)
      .min(1, { message: 'At least one slot is required' }),
  });
}

export type GroupFormValues = z.infer<ReturnType<typeof createGroupFormSchema>>;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_SLOT = {
  name: '',
  required_count: 1,
  calendar_ids: [] as number[],
  pool_ids: [] as number[],
};

function getDefaultValues(group: CalendarGroup | null): GroupFormValues {
  if (group === null) {
    return { name: '', description: '', slots: [{ ...DEFAULT_SLOT }] };
  }
  return {
    name: group.name,
    description: group.description ?? '',
    slots: group.slots.map((slot) => ({
      name: slot.name,
      required_count: slot.required_count ?? 1,
      ...splitSavedSlotRoster(slot.calendars, slot.pools),
    })),
  };
}

// ---------------------------------------------------------------------------
// GroupFormDialog
// ---------------------------------------------------------------------------

export interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The group being edited; omit or pass null to create a new one. */
  group?: CalendarGroup | null;
}

export function GroupFormDialog({
  open,
  onOpenChange,
  group = null,
}: GroupFormDialogProps) {
  const isEdit = group !== null;

  const { calendars, isLoading: calendarsLoading } = useAllCalendars({
    page: 1,
    pageSize: CALENDARS_PAGE_SIZE,
    ordering: null,
    search: null,
  });
  const {
    pools,
    isLoading: poolsLoading,
    isTruncated: poolsTruncated,
  } = useAllCalendarPools();

  const rosters = React.useMemo(() => buildPoolRosters(pools), [pools]);
  // Rebuilding the resolver on every roster change keeps the cross-field rules
  // honest: attaching a pool widens the roster, which can make an already-typed
  // required_count valid (or a pool edit in another tab make it invalid).
  const resolver = React.useMemo(
    () => zodResolver(createGroupFormSchema(rosters)),
    [rosters]
  );

  const { createCalendarGroup, createCalendarGroupMutation } =
    useCreateCalendarGroup();
  const { updateCalendarGroup, updateCalendarGroupMutation } =
    useUpdateCalendarGroup();

  const form = useForm<GroupFormValues>({
    resolver,
    defaultValues: getDefaultValues(group),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'slots',
  });

  // Re-seed on open, and whenever a different group is handed in — the groups
  // table reuses one mounted dialog across every row's Edit action.
  React.useEffect(() => {
    form.reset(getDefaultValues(group));
  }, [open, group, form]);

  const isPending =
    createCalendarGroupMutation.isPending ||
    updateCalendarGroupMutation.isPending;

  const watchedSlots = form.watch('slots');

  // Saved slot names no longer present in the form. Because the API matches
  // slots by name, each of these is dropped on submit — whether the user
  // deleted the slot or merely retyped its name, the outcome is the same, so
  // the warning names the consequence rather than guessing the intent.
  //
  // Not memoized on `watchedSlots`: react-hook-form mutates its values object
  // in place, so the array's identity survives an edit and a `useMemo` keyed on
  // it would never recompute. The list is a handful of names — just derive it.
  const currentSlotNames = new Set(
    watchedSlots.map((s) => s.name.trim()).filter(Boolean)
  );
  const droppedSlots = isEdit
    ? group.slots.map((s) => s.name).filter((n) => !currentSlotNames.has(n))
    : [];

  const onSubmit = async (values: GroupFormValues) => {
    // `pool_ids` is always sent, never omitted: the API reads an omitted
    // `pool_ids` as "leave attachments unchanged" for an existing slot but as
    // "no pools" for a new one, and a renamed slot arrives as a new one.
    const slots = values.slots.map((slot, index) => ({
      name: slot.name,
      order: index,
      required_count: slot.required_count,
      calendar_ids: slot.calendar_ids,
      pool_ids: slot.pool_ids,
    }));

    try {
      if (isEdit) {
        await updateCalendarGroup(group.id, {
          name: values.name,
          description: values.description ?? '',
          slots,
        });
        toast.success('Calendar group updated', {
          description: `"${values.name}" has been saved.`,
        });
      } else {
        await createCalendarGroup({
          name: values.name,
          description: values.description ?? undefined,
          slots,
        });
        toast.success('Calendar group created', {
          description: `"${values.name}" is now available for booking.`,
        });
      }
      onOpenChange(false);
    } catch (err) {
      handleMutationError(err, {
        title: isEdit
          ? 'Failed to update calendar group'
          : 'Failed to create calendar group',
        form,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* shadcn internal: DialogContent exposes no size/scroll props. */}
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit calendar group' : 'New calendar group'}
          </DialogTitle>
          <DialogDescription>
            Each slot offers a roster of calendars to pick from when booking.
            Build that roster from calendar pools, from individual calendars, or
            from both.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <FormRootMessage />
          <FormLayout onSubmit={form.handleSubmit(onSubmit)} gap={4} noValidate>
            {/* Group name */}
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group name</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      placeholder='e.g. Frontend Team'
                      autoComplete='off'
                      {...field}
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
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      placeholder='What is this group used for?'
                      autoComplete='off'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Slots */}
            <VStack gap={3}>
              <HStack gap={2} align='center' justify='between'>
                <Text size='sm' weight='medium'>
                  Slots
                </Text>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => append({ ...DEFAULT_SLOT })}
                  disabled={isPending}
                >
                  <Plus />
                  Add slot
                </Button>
              </HStack>

              {/* Slots-level error (< 1 slot) */}
              {form.formState.errors.slots?.root && (
                <Text size='xs' color='destructive'>
                  {form.formState.errors.slots.root.message}
                </Text>
              )}
              {/* Zod array-level message (also shows as .message directly) */}
              {typeof form.formState.errors.slots?.message === 'string' && (
                <Text size='xs' color='destructive'>
                  {form.formState.errors.slots.message}
                </Text>
              )}

              {fields.map((fieldItem, index) => (
                <SlotEditor
                  key={fieldItem.id}
                  index={index}
                  form={form}
                  calendars={calendars}
                  calendarsLoading={calendarsLoading}
                  pools={pools}
                  poolsLoading={poolsLoading}
                  rosters={rosters}
                  isPending={isPending}
                  onRemove={() => remove(index)}
                  canRemove={fields.length > 1}
                />
              ))}
            </VStack>

            {poolsTruncated ? (
              <Text size='xs' color='muted-foreground'>
                This organization has more calendar pools than the picker can
                list. Search for the pool on the Calendar pools page if it is
                missing here.
              </Text>
            ) : null}

            {droppedSlots.length > 0 ? (
              <VStack
                gap={1}
                p={3}
                border
                radius='md'
                data-testid='dropped-slots-warning'
              >
                <Text size='sm' weight='medium'>
                  {droppedSlots.length === 1
                    ? 'A slot will be removed'
                    : 'Slots will be removed'}
                </Text>
                <Text size='xs' color='muted-foreground'>
                  Slots are matched by name, so {droppedSlots.join(', ')} will
                  be removed on save — renaming a slot removes it and creates a
                  new one. Any group-scoped availability windows, blocked time,
                  and quota rules on {droppedSlots.length === 1 ? 'it' : 'them'}{' '}
                  are lost, and the save is refused while{' '}
                  {droppedSlots.length === 1 ? 'it has' : 'they have'} future
                  bookings.
                </Text>
              </VStack>
            ) : null}

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
                disabled={isPending || calendarsLoading || poolsLoading}
                data-testid={
                  isEdit ? 'edit-group-submit' : 'create-group-submit'
                }
              >
                {isPending
                  ? isEdit
                    ? 'Saving…'
                    : 'Creating…'
                  : isEdit
                    ? 'Save group'
                    : 'Create group'}
              </Button>
            </DialogFooter>
          </FormLayout>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SlotEditor — one slot's editable block inside the form.
// ---------------------------------------------------------------------------

interface SlotEditorProps {
  index: number;
  form: UseFormReturn<GroupFormValues>;
  calendars: Calendar[];
  calendarsLoading: boolean;
  pools: CalendarPool[];
  poolsLoading: boolean;
  rosters: PoolRosters;
  isPending: boolean;
  onRemove: () => void;
  canRemove: boolean;
}

function SlotEditor({
  index,
  form,
  calendars,
  calendarsLoading,
  pools,
  poolsLoading,
  rosters,
  isPending,
  onRemove,
  canRemove,
}: SlotEditorProps) {
  const calendarIds = form.watch(`slots.${index}.calendar_ids`);
  const poolIds = form.watch(`slots.${index}.pool_ids`);

  const rosterSize = effectiveRoster(calendarIds, poolIds, rosters).length;
  const fromPools = effectiveRoster([], poolIds, rosters).length;

  return (
    <VStack
      gap={3}
      p={3}
      border
      radius='md'
      data-testid={`slot-editor-${index}`}
    >
      {/* Slot header row */}
      <HStack gap={2} align='center' justify='between'>
        <Text size='sm' weight='semibold'>
          Slot {index + 1}
        </Text>
        {canRemove && (
          <Button
            type='button'
            size='icon'
            variant='ghost'
            aria-label={`Remove slot ${index + 1}`}
            onClick={onRemove}
            disabled={isPending}
          >
            <Trash2 />
          </Button>
        )}
      </HStack>

      {/* Slot name */}
      <FormField
        control={form.control}
        name={`slots.${index}.name`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Slot name</FormLabel>
            <FormControl>
              <Input
                type='text'
                placeholder='e.g. Interviewer'
                autoComplete='off'
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Required count */}
      <FormField
        control={form.control}
        name={`slots.${index}.required_count`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Required count</FormLabel>
            <FormControl>
              <Input
                type='number'
                min={1}
                max={rosterSize || 100}
                {...field}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
            </FormControl>
            <Text size='xs' color='muted-foreground'>
              How many calendars must be picked from this slot&apos;s roster
              when booking.
            </Text>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Calendar pools */}
      <VStack gap={2}>
        <Label htmlFor={`slot-${index}-pools`}>Calendar pools</Label>

        <Combobox
          id={`slot-${index}-pools`}
          multiple
          options={pools.map((pool) => ({
            value: String(pool.id),
            label: `${pool.name} (${pool.calendars.length})`,
          }))}
          value={poolIds.map(String)}
          onValueChange={(values) =>
            form.setValue(
              `slots.${index}.pool_ids`,
              values.map((v) => parseInt(v, 10)),
              { shouldValidate: true }
            )
          }
          isLoading={poolsLoading}
          disabled={isPending}
          placeholder='Attach pools…'
          emptyText='No calendar pools yet.'
        />

        <Text size='xs' color='muted-foreground'>
          Editing a pool later updates this slot automatically.
        </Text>
      </VStack>

      {/* Individually picked calendars */}
      <VStack gap={2}>
        <Label htmlFor={`slot-${index}-calendar-pool`}>
          Individual calendars
        </Label>

        <Combobox
          id={`slot-${index}-calendar-pool`}
          multiple
          options={calendars.map((cal) => ({
            value: String(cal.id),
            label: cal.name,
          }))}
          value={calendarIds.map(String)}
          onValueChange={(values) =>
            form.setValue(
              `slots.${index}.calendar_ids`,
              values.map((v) => parseInt(v, 10)),
              { shouldValidate: true }
            )
          }
          isLoading={calendarsLoading}
          disabled={isPending}
          placeholder='Select calendars…'
          emptyText='No calendars found.'
        />

        {/* Roster error (empty roster) */}
        {form.formState.errors.slots?.[index]?.calendar_ids && (
          <Text size='xs' color='destructive'>
            {form.formState.errors.slots[index]?.calendar_ids?.message}
          </Text>
        )}
      </VStack>

      <Text
        size='xs'
        color='muted-foreground'
        data-testid={`slot-roster-size-${index}`}
      >
        {rosterSize === 0
          ? 'Roster is empty.'
          : `Roster: ${rosterSize} calendar${rosterSize === 1 ? '' : 's'}${
              fromPools > 0 ? ` (${fromPools} from pools)` : ''
            }.`}
      </Text>
    </VStack>
  );
}
