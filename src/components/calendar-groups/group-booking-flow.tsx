'use client';

/**
 * GroupBookingFlow — book an event through a Calendar Group.
 *
 * Flow (all inside one dialog):
 *  1. Pick a group → its slots define the per-slot pickers.
 *  2. Enter title, a desired time (date + start/end) and timezone.
 *  3. "Check availability" → calendarGroupsAvailabilityCreate for the chosen
 *     range. Each slot is overlaid with its free candidates; a slot whose free
 *     candidates are fewer than its required_count is marked UNSATISFIABLE.
 *  4. Per-slot picker: only FREE candidates are selectable (non-free are
 *     disabled). The member must pick exactly `required_count` per slot.
 *  5. Submit is BLOCKED until every slot is satisfied AND its selection is the
 *     exact required count. An unsatisfiable slot hard-blocks submit (you can't
 *     book an impossible group slot). Conflicts surface via ConflictSurface.
 *  6. On submit → calendarGroupsEventsCreate with slot_selections (which
 *     calendars satisfy which slot). Submit disables while pending.
 *
 * The whole-group bookable-slot suggestions (calendarGroupsBookableSlotsList)
 * are offered as quick-fill chips for the time fields so the member can start
 * from a known-good range rather than guessing.
 */

import * as React from 'react';
import { toast } from 'sonner';
import { DateTime } from 'luxon';
import { TriangleAlert } from 'lucide-react';
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VStack, HStack, Text } from '@/components/layout';
import { useCalendarGroups } from '@/hooks/calendar-groups/use-calendar-groups';
import {
  useGroupBooking,
  buildSlotAvailability,
  isSelectionComplete,
  hasUnsatisfiableSlot,
  slotRequiredCount,
  type SlotViewModel,
} from '@/hooks/calendar-groups/use-group-booking';
import { ConflictSurface } from '@/components/bookings/conflict-surface';
import type { CalendarGroup, BookableSlotProposal } from '@/client';
import { zonedFormat } from '@/lib/datetime/index';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GroupBookingFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// GroupBookingFlow
// ---------------------------------------------------------------------------

export function GroupBookingFlow({
  open,
  onOpenChange,
}: GroupBookingFlowProps) {
  const { groups, isLoading: groupsLoading } = useCalendarGroups();
  const { fetchBookableSlots, fetchSlotAvailability, bookGroupEvent } =
    useGroupBooking();

  const localZone = React.useMemo(() => DateTime.local().zoneName ?? 'UTC', []);

  const [groupId, setGroupId] = React.useState<string>('');
  const [title, setTitle] = React.useState('');
  const [date, setDate] = React.useState(DateTime.local().toISODate() ?? '');
  const [startTime, setStartTime] = React.useState('09:00');
  const [endTime, setEndTime] = React.useState('10:00');
  const [timezone, setTimezone] = React.useState(localZone);

  // Suggestions (whole-group bookable ranges).
  const [suggestions, setSuggestions] = React.useState<BookableSlotProposal[]>(
    []
  );

  // Per-slot free-candidate overlay from the availability check, keyed by slot
  // id. `null` = availability not yet checked for the current range. Slot view
  // models are derived during render from the group + this overlay.
  const [availabilityBySlot, setAvailabilityBySlot] = React.useState<Record<
    number,
    number[]
  > | null>(null);
  const [selection, setSelection] = React.useState<Record<number, number[]>>(
    {}
  );

  const [conflictsShown, setConflictsShown] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  const selectedGroup: CalendarGroup | undefined = React.useMemo(
    () => groups.find((g) => String(g.id) === groupId),
    [groups, groupId]
  );

  // Reset everything when the dialog closes.
  React.useEffect(() => {
    if (!open) {
      setGroupId('');
      setTitle('');
      setDate(DateTime.local().toISODate() ?? '');
      setStartTime('09:00');
      setEndTime('10:00');
      setTimezone(localZone);
      setSuggestions([]);
      setAvailabilityBySlot(null);
      setSelection({});
      setConflictsShown(false);
      setIsPending(false);
    }
  }, [open, localZone]);

  // Clear the availability overlay + selection whenever the chosen group or
  // time range changes — they no longer describe the current request.
  const invalidateAvailability = React.useCallback(() => {
    setAvailabilityBySlot(null);
    setSelection({});
  }, []);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Build ISO start/end from the date/time/zone fields. */
  const buildRange = React.useCallback(() => {
    const startDt = DateTime.fromISO(`${date}T${startTime}:00`, {
      zone: timezone,
    });
    const endDt = DateTime.fromISO(`${date}T${endTime}:00`, { zone: timezone });
    return { startISO: startDt.toISO() ?? '', endISO: endDt.toISO() ?? '' };
  }, [date, startTime, endTime, timezone]);

  // Derive the per-slot view models during render from the group's slots and
  // the (possibly null) availability overlay. No effect / derived-state mirror.
  const slotViews: SlotViewModel[] = React.useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.slots.map((slot) => ({
      slotId: slot.id,
      name: slot.name,
      requiredCount: slotRequiredCount(slot),
      pool: slot.calendars.map((c) => ({ id: c.id, name: c.name })),
      availableCalendarIds: availabilityBySlot?.[slot.id] ?? null,
    }));
  }, [selectedGroup, availabilityBySlot]);

  // -------------------------------------------------------------------------
  // Suggestions
  // -------------------------------------------------------------------------

  const handleLoadSuggestions = async () => {
    if (!selectedGroup) return;
    setIsPending(true);
    try {
      const { startISO, endISO } = buildRange();
      const durationSeconds = Math.max(
        900,
        Math.round(
          (DateTime.fromISO(endISO).toMillis() -
            DateTime.fromISO(startISO).toMillis()) /
            1000
        )
      );
      // Search the whole day around the chosen date for candidate ranges.
      const dayStart =
        DateTime.fromISO(`${date}T00:00:00`, { zone: timezone }).toISO() ?? '';
      const dayEnd =
        DateTime.fromISO(`${date}T23:59:59`, { zone: timezone }).toISO() ?? '';
      const proposals = await fetchBookableSlots({
        groupId: selectedGroup.id,
        durationSeconds,
        searchWindowStart: dayStart,
        searchWindowEnd: dayEnd,
      });
      setSuggestions(proposals);
    } catch (err) {
      toast.error('Could not load bookable times', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsPending(false);
    }
  };

  const applySuggestion = (proposal: BookableSlotProposal) => {
    const start = DateTime.fromISO(proposal.start_time).setZone(timezone);
    const end = DateTime.fromISO(proposal.end_time).setZone(timezone);
    setDate(start.toISODate() ?? date);
    setStartTime(start.toFormat('HH:mm'));
    setEndTime(end.toFormat('HH:mm'));
    invalidateAvailability();
  };

  // -------------------------------------------------------------------------
  // Availability check → overlay free candidates onto each slot.
  // -------------------------------------------------------------------------

  const handleCheckAvailability = async () => {
    if (!selectedGroup) return;
    setIsPending(true);
    setConflictsShown(false);
    try {
      const { startISO, endISO } = buildRange();
      const rangeAvailability = await fetchSlotAvailability(
        selectedGroup.id,
        startISO,
        endISO
      );
      const slotAvail = buildSlotAvailability(
        selectedGroup.slots,
        rangeAvailability
      );
      const availById: Record<number, number[]> = {};
      for (const s of slotAvail) {
        availById[s.slotId] = s.availableCalendarIds;
      }
      setAvailabilityBySlot(availById);
      // Drop any prior selections that are no longer free.
      setSelection((prev) => {
        const next: Record<number, number[]> = {};
        for (const [slotIdStr, ids] of Object.entries(prev)) {
          const free = availById[Number(slotIdStr)] ?? [];
          next[Number(slotIdStr)] = ids.filter((id) => free.includes(id));
        }
        return next;
      });
    } catch (err) {
      toast.error('Availability check failed', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsPending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Per-slot selection toggle (enforces required count + only-free).
  // -------------------------------------------------------------------------

  const toggleCalendar = (view: SlotViewModel, calendarId: number) => {
    const free = view.availableCalendarIds ?? [];
    if (!free.includes(calendarId)) return; // non-free candidates are inert
    setSelection((prev) => {
      const current = prev[view.slotId] ?? [];
      if (current.includes(calendarId)) {
        return {
          ...prev,
          [view.slotId]: current.filter((id) => id !== calendarId),
        };
      }
      // Cap selection at the required count (replacing the oldest when full).
      const next =
        current.length >= view.requiredCount
          ? [...current.slice(1), calendarId]
          : [...current, calendarId];
      return { ...prev, [view.slotId]: next };
    });
  };

  // -------------------------------------------------------------------------
  // Derived submit gating.
  // -------------------------------------------------------------------------

  const availabilityChecked = availabilityBySlot !== null;
  const unsatisfiable = availabilityChecked && hasUnsatisfiableSlot(slotViews);
  const selectionComplete =
    availabilityChecked && isSelectionComplete(slotViews, selection);
  const canSubmit =
    !!selectedGroup &&
    title.trim().length > 0 &&
    availabilityChecked &&
    !unsatisfiable &&
    selectionComplete &&
    !isPending;

  // -------------------------------------------------------------------------
  // Submit.
  // -------------------------------------------------------------------------

  const handleSubmit = async () => {
    if (!selectedGroup || !canSubmit) return;
    setIsPending(true);
    try {
      const { startISO, endISO } = buildRange();
      const slotSelections = slotViews.map((view) => ({
        slot_id: view.slotId,
        calendar_ids: selection[view.slotId] ?? [],
      }));
      await bookGroupEvent({
        groupId: selectedGroup.id,
        title: title.trim(),
        startTime: startISO,
        endTime: endISO,
        timezone,
        slotSelections,
      });
      toast.success('Group booking created', {
        description: `"${title.trim()}" has been scheduled on ${selectedGroup.name}.`,
      });
      onOpenChange(false);
    } catch (err) {
      // Backend may reject (e.g. a race made a slot busy). Surface conflicts.
      setConflictsShown(true);
      toast.error('Failed to book group event', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsPending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render.
  // -------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Book a group</DialogTitle>
        </DialogHeader>

        {conflictsShown ? (
          <ConflictSurface
            conflicts={[]}
            onProceed={() => {
              setConflictsShown(false);
              void handleCheckAvailability();
            }}
            onAdjust={() => setConflictsShown(false)}
            isPending={isPending}
          />
        ) : (
          <VStack gap={4}>
            {/* Group picker */}
            <VStack gap={2}>
              <label
                htmlFor='group-select'
                className='text-sm leading-none font-medium'
              >
                Calendar group
              </label>
              <Select
                value={groupId}
                onValueChange={(v) => {
                  setGroupId(v);
                  invalidateAvailability();
                }}
                disabled={groupsLoading}
              >
                <SelectTrigger id='group-select' aria-label='Calendar group'>
                  <SelectValue placeholder='Select a group' />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </VStack>

            {/* Title */}
            <VStack gap={2}>
              <label
                htmlFor='group-title'
                className='text-sm leading-none font-medium'
              >
                Title
              </label>
              <Input
                id='group-title'
                type='text'
                placeholder='Meeting title'
                autoComplete='off'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </VStack>

            {/* Date + time */}
            <VStack gap={2}>
              <label
                htmlFor='group-date'
                className='text-sm leading-none font-medium'
              >
                Date
              </label>
              <Input
                id='group-date'
                type='date'
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  invalidateAvailability();
                }}
              />
            </VStack>
            <HStack gap={3}>
              <VStack gap={2} className='flex-1'>
                <label
                  htmlFor='group-start'
                  className='text-sm leading-none font-medium'
                >
                  Start time
                </label>
                <Input
                  id='group-start'
                  type='time'
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    invalidateAvailability();
                  }}
                />
              </VStack>
              <VStack gap={2} className='flex-1'>
                <label
                  htmlFor='group-end'
                  className='text-sm leading-none font-medium'
                >
                  End time
                </label>
                <Input
                  id='group-end'
                  type='time'
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    invalidateAvailability();
                  }}
                />
              </VStack>
            </HStack>

            {/* Suggestions */}
            {selectedGroup && (
              <VStack gap={2}>
                <HStack gap={2} align='center' justify='between'>
                  <Text size='sm' className='font-medium'>
                    Suggested times
                  </Text>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={handleLoadSuggestions}
                    disabled={isPending}
                  >
                    Find times
                  </Button>
                </HStack>
                {suggestions.length > 0 && (
                  <HStack gap={2} className='flex-wrap'>
                    {suggestions.slice(0, 8).map((p) => (
                      <Button
                        key={`${p.start_time}-${p.end_time}`}
                        type='button'
                        size='xs'
                        variant='outline'
                        onClick={() => applySuggestion(p)}
                      >
                        {zonedFormat(p.start_time, timezone, 'MMM d, h:mm a')}
                      </Button>
                    ))}
                  </HStack>
                )}
              </VStack>
            )}

            {/* Check availability */}
            {selectedGroup && (
              <Button
                type='button'
                variant='secondary'
                onClick={handleCheckAvailability}
                disabled={isPending}
              >
                {isPending ? 'Checking…' : 'Check availability'}
              </Button>
            )}

            {/* Unsatisfiable warning */}
            {unsatisfiable && (
              <Alert
                className='border-warning bg-background'
                data-testid='unsatisfiable-alert'
              >
                <TriangleAlert className='text-warning h-4 w-4' />
                <AlertTitle>One or more slots can&apos;t be filled</AlertTitle>
                <AlertDescription>
                  At this time, some slots don&apos;t have enough free calendars
                  to meet their required count. Pick another time or load a
                  suggested one.
                </AlertDescription>
              </Alert>
            )}

            {/* Per-slot pickers */}
            {availabilityChecked &&
              slotViews.map((view) => (
                <SlotPicker
                  key={view.slotId}
                  view={view}
                  selected={selection[view.slotId] ?? []}
                  onToggle={(calId) => toggleCalendar(view, calId)}
                />
              ))}

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
                type='button'
                onClick={handleSubmit}
                disabled={!canSubmit}
                data-testid='group-book-submit'
              >
                {isPending ? 'Booking…' : 'Book group'}
              </Button>
            </DialogFooter>
          </VStack>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SlotPicker — one slot's candidate pool with only-free selectability.
// ---------------------------------------------------------------------------

interface SlotPickerProps {
  view: SlotViewModel;
  selected: number[];
  onToggle: (calendarId: number) => void;
}

function SlotPicker({ view, selected, onToggle }: SlotPickerProps) {
  const free = view.availableCalendarIds ?? [];
  const isSatisfiable = free.length >= view.requiredCount;
  const someBusy = view.pool.some((c) => !free.includes(c.id));

  return (
    <VStack
      gap={2}
      p={3}
      border
      radius='md'
      data-testid={`slot-picker-${view.slotId}`}
    >
      <HStack gap={2} align='center' justify='between'>
        <Text size='sm' className='font-medium'>
          {view.name}
        </Text>
        <Text
          size='xs'
          color={isSatisfiable ? 'muted-foreground' : 'destructive'}
        >
          Pick {view.requiredCount} of {free.length} free · selected{' '}
          {selected.length}
        </Text>
      </HStack>

      {!isSatisfiable && (
        <Text size='xs' color='destructive' data-testid='slot-unsatisfiable'>
          Not enough free calendars for this slot at this time.
        </Text>
      )}

      <VStack gap={2}>
        {view.pool.map((cal) => {
          const isFree = free.includes(cal.id);
          const isChecked = selected.includes(cal.id);
          return (
            <HStack key={cal.id} gap={2} align='center'>
              <Checkbox
                id={`slot-${view.slotId}-cal-${cal.id}`}
                checked={isChecked}
                disabled={!isFree}
                onCheckedChange={() => onToggle(cal.id)}
                aria-label={`${cal.name}${isFree ? '' : ' (busy)'}`}
              />
              <label
                htmlFor={`slot-${view.slotId}-cal-${cal.id}`}
                className={
                  isFree
                    ? 'cursor-pointer text-sm select-none'
                    : 'text-muted-foreground text-sm select-none'
                }
              >
                {cal.name}
                {!isFree ? ' · busy' : ''}
              </label>
            </HStack>
          );
        })}
      </VStack>

      {someBusy && isSatisfiable && (
        <Text size='xs' color='muted-foreground'>
          Busy calendars are disabled for this time.
        </Text>
      )}
    </VStack>
  );
}
