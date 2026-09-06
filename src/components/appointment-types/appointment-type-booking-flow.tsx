'use client';

/**
 * AppointmentTypeBookingFlow — book an event through an Appointment Type.
 *
 * Flow (all inside one dialog):
 *  1. Pick an appointment type → its slots define the per-slot pickers.
 *  2. Enter title, a desired time (date + start/end) and timezone.
 *  3. "Check availability" → appointmentTypesAvailabilityCreate for the chosen
 *     range. Each slot is overlaid with its free candidates; a slot whose free
 *     candidates are fewer than its required_count is marked UNSATISFIABLE.
 *  4. Per-slot picker: only FREE candidates are selectable (non-free are
 *     disabled). The member must pick exactly `required_count` per slot.
 *  5. Submit is BLOCKED until every slot is satisfied AND its selection is the
 *     exact required count. An unsatisfiable slot hard-blocks submit (you can't
 *     book an impossible appointment type slot).
 *  6. On submit → appointmentTypesEventsCreate with slot_selections (which
 *     calendars satisfy which slot). Submit disables while pending.
 *  7. If the backend rejects (race condition: a slot became busy between the
 *     availability check and the submit), a race alert is shown and availability
 *     is refreshed automatically so the member can re-review and re-submit.
 */

import * as React from 'react';
import { toast } from 'sonner';
import { DateTime } from 'luxon';
import { TriangleAlert, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from 'vinta-schedule-design-system/ui/dialog';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Label } from 'vinta-schedule-design-system/ui/label';
import { Checkbox } from 'vinta-schedule-design-system/ui/checkbox';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'vinta-schedule-design-system/ui/alert';
import { Combobox } from 'vinta-schedule-design-system/ui/combobox';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { VStack, HStack, Text } from 'vinta-schedule-design-system/layout';
import { useAppointmentTypes } from '@/hooks/appointment-types/use-appointment-types';
import {
  useAppointmentTypeBooking,
  buildSlotAvailability,
  isSelectionComplete,
  hasUnsatisfiableSlot,
  slotRequiredCount,
  type SlotViewModel,
} from '@/hooks/appointment-types/use-appointment-type-booking';
import { cn } from '@/lib/utils/index';
import type { AppointmentType, BookableSlotProposal } from '@/client';
import { zonedFormat } from '@/lib/datetime/index';

import { handleMutationError } from '@/lib/utils/form-errors';

// ---------------------------------------------------------------------------
// Common IANA timezone options for the timezone picker.
// ---------------------------------------------------------------------------

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Honolulu',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Lima',
  'America/Mexico_City',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Pacific/Auckland',
  'Pacific/Honolulu',
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AppointmentTypeBookingFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// AppointmentTypeBookingFlow
// ---------------------------------------------------------------------------

export function AppointmentTypeBookingFlow({
  open,
  onOpenChange,
}: AppointmentTypeBookingFlowProps) {
  const { appointmentTypes, isLoading: appointmentTypesLoading } =
    useAppointmentTypes();
  const {
    fetchBookableSlots,
    fetchSlotAvailability,
    bookAppointmentTypeEvent,
  } = useAppointmentTypeBooking();

  const localZone = React.useMemo(() => DateTime.local().zoneName ?? 'UTC', []);

  const [appointmentTypeId, setAppointmentTypeId] = React.useState<string>('');
  const [title, setTitle] = React.useState('');
  const [date, setDate] = React.useState(DateTime.local().toISODate() ?? '');
  const [startTime, setStartTime] = React.useState('09:00');
  const [endTime, setEndTime] = React.useState('10:00');
  const [timezone, setTimezone] = React.useState(localZone);

  // Suggestions (whole-appointment-type bookable ranges).
  const [suggestions, setSuggestions] = React.useState<BookableSlotProposal[]>(
    []
  );

  /**
   * Per-slot free-candidate overlay from the availability check, keyed by slot
   * id.
   *
   * Two distinct states:
   *  - `null`  → availability not yet checked for the current range (pre-check).
   *              The slot pickers are hidden; submit is blocked.
   *  - `Record<number, number[]>` → checked. Each slot id maps to its free
   *    calendar ids. An entry of `[]` means checked but zero free (unsatisfiable).
   *    A slot absent from the API response is normalised to `[]` by
   *    buildSlotAvailability, so it is never conflated with the unchecked state.
   */
  const [availabilityBySlot, setAvailabilityBySlot] = React.useState<Record<
    number,
    number[]
  > | null>(null);
  const [selection, setSelection] = React.useState<Record<number, number[]>>(
    {}
  );

  // When true, a race condition was detected: the backend rejected the booking
  // because a slot became busy after the availability check. A bespoke alert is
  // shown and availability is refreshed so the member can re-review and retry.
  const [raceDetected, setRaceDetected] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  const selectedAppointmentType: AppointmentType | undefined = React.useMemo(
    () => appointmentTypes.find((g) => String(g.id) === appointmentTypeId),
    [appointmentTypes, appointmentTypeId]
  );

  // Reset everything when the dialog closes.
  React.useEffect(() => {
    if (!open) {
      setAppointmentTypeId('');
      setTitle('');
      setDate(DateTime.local().toISODate() ?? '');
      setStartTime('09:00');
      setEndTime('10:00');
      setTimezone(localZone);
      setSuggestions([]);
      setAvailabilityBySlot(null);
      setSelection({});
      setRaceDetected(false);
      setIsPending(false);
    }
  }, [open, localZone]);

  // Clear the availability overlay + selection whenever the chosen appointment type,
  // time range, or timezone changes — they no longer describe the current request.
  const invalidateAvailability = React.useCallback(() => {
    setAvailabilityBySlot(null);
    setSelection({});
    setRaceDetected(false);
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

  // Derive the per-slot view models during render from the appointment type's slots and
  // the (possibly null) availability overlay. No effect / derived-state mirror.
  const slotViews: SlotViewModel[] = React.useMemo(() => {
    if (!selectedAppointmentType) return [];
    return selectedAppointmentType.slots.map((slot) => ({
      slotId: slot.id,
      name: slot.name,
      requiredCount: slotRequiredCount(slot),
      pool: slot.calendars.map((c) => ({ id: c.id, name: c.name })),
      availableCalendarIds: availabilityBySlot?.[slot.id] ?? null,
    }));
  }, [selectedAppointmentType, availabilityBySlot]);

  // -------------------------------------------------------------------------
  // Suggestions
  // -------------------------------------------------------------------------

  const handleLoadSuggestions = async () => {
    if (!selectedAppointmentType) return;
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
        appointmentTypeId: selectedAppointmentType.id,
        durationSeconds,
        searchWindowStart: dayStart,
        searchWindowEnd: dayEnd,
      });
      setSuggestions(proposals);
    } catch (err) {
      handleMutationError(err, { title: 'Could not load bookable times' });
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
    if (!selectedAppointmentType) return;
    setIsPending(true);
    setRaceDetected(false);
    try {
      const { startISO, endISO } = buildRange();
      const rangeAvailability = await fetchSlotAvailability(
        selectedAppointmentType.id,
        startISO,
        endISO
      );
      const slotAvail = buildSlotAvailability(
        selectedAppointmentType.slots,
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
      handleMutationError(err, { title: 'Availability check failed' });
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
    !!selectedAppointmentType &&
    title.trim().length > 0 &&
    availabilityChecked &&
    !unsatisfiable &&
    selectionComplete &&
    !isPending;

  // -------------------------------------------------------------------------
  // Submit.
  // -------------------------------------------------------------------------

  const handleSubmit = async () => {
    if (!selectedAppointmentType || !canSubmit) return;
    setIsPending(true);
    try {
      const { startISO, endISO } = buildRange();
      const slotSelections = slotViews.map((view) => ({
        slot_id: view.slotId,
        calendar_ids: selection[view.slotId] ?? [],
      }));
      await bookAppointmentTypeEvent({
        appointmentTypeId: selectedAppointmentType.id,
        title: title.trim(),
        startTime: startISO,
        endTime: endISO,
        timezone,
        slotSelections,
      });
      toast.success('Appointment Type booking created', {
        description: `"${title.trim()}" has been scheduled on ${selectedAppointmentType.name}.`,
      });
      onOpenChange(false);
    } catch (err) {
      // Backend rejected (e.g. a race made a slot busy between the availability
      // check and the create call). Refresh availability BEFORE showing the
      // alert so the member sees the updated slot pickers immediately and can
      // re-submit without an extra "Check availability" click.
      handleMutationError(err, {
        title: 'Failed to book appointment type event',
      });
      // Re-check availability with isPending still true to avoid flash of the
      // old state. setRaceDetected fires after the refresh completes.
      try {
        if (selectedAppointmentType) {
          const { startISO, endISO } = buildRange();
          const rangeAvailability = await fetchSlotAvailability(
            selectedAppointmentType.id,
            startISO,
            endISO
          );
          const slotAvail = buildSlotAvailability(
            selectedAppointmentType.slots,
            rangeAvailability
          );
          const availById: Record<number, number[]> = {};
          for (const s of slotAvail) {
            availById[s.slotId] = s.availableCalendarIds;
          }
          setAvailabilityBySlot(availById);
          // Prune selection to only still-free calendars.
          setSelection((prev) => {
            const next: Record<number, number[]> = {};
            for (const [slotIdStr, ids] of Object.entries(prev)) {
              const free = availById[Number(slotIdStr)] ?? [];
              next[Number(slotIdStr)] = ids.filter((id) => free.includes(id));
            }
            return next;
          });
        }
      } catch {
        // Refresh failed; the member can still click "Check availability" manually.
      }
      setRaceDetected(true);
    } finally {
      setIsPending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render.
  // -------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* shadcn internal: DialogContent exposes no size/scroll props. */}
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Book an appointment type</DialogTitle>
        </DialogHeader>

        <VStack gap={4}>
          {/* Race-condition alert — shown inline above the slot pickers so the
              member can see the refreshed availability immediately below it. */}
          {raceDetected && (
            // TODO(ds-gap): Alert has no `warning` variant — the warning border
            // is the only way to tint it today.
            <Alert
              className='border-warning bg-background'
              data-testid='race-alert'
            >
              <Icon icon={RefreshCw} color='warning' />
              <AlertTitle>A slot became busy while booking</AlertTitle>
              <AlertDescription>
                Availability was refreshed below — review the updated slot
                pickers and re-submit when ready.
              </AlertDescription>
            </Alert>
          )}

          {/* Appointment Type picker */}
          <VStack gap={2}>
            <Label htmlFor='appointment-type-picker'>Appointment type</Label>
            <Combobox
              id='appointment-type-picker'
              options={appointmentTypes.map((g) => ({
                value: String(g.id),
                label: g.name,
              }))}
              value={appointmentTypeId}
              onValueChange={(v) => {
                setAppointmentTypeId(v);
                invalidateAvailability();
              }}
              disabled={appointmentTypesLoading}
              placeholder='Select an appointment type'
              searchPlaceholder='Search appointment types…'
            />
          </VStack>

          {/* Title */}
          <VStack gap={2}>
            <Label htmlFor='appointment-type-title'>Title</Label>
            <Input
              id='appointment-type-title'
              type='text'
              placeholder='Meeting title'
              autoComplete='off'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </VStack>

          {/* Date + time */}
          <VStack gap={2}>
            <Label htmlFor='appointment-type-date'>Date</Label>
            <Input
              id='appointment-type-date'
              type='date'
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                invalidateAvailability();
              }}
            />
          </VStack>
          <HStack gap={3}>
            <VStack gap={2} grow shrink basis='0%'>
              <Label htmlFor='appointment-type-start'>Start time</Label>
              <Input
                id='appointment-type-start'
                type='time'
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  invalidateAvailability();
                }}
              />
            </VStack>
            <VStack gap={2} grow shrink basis='0%'>
              <Label htmlFor='appointment-type-end'>End time</Label>
              <Input
                id='appointment-type-end'
                type='time'
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  invalidateAvailability();
                }}
              />
            </VStack>
          </HStack>

          {/* Timezone picker */}
          <VStack gap={2}>
            <Label htmlFor='appointment-type-timezone'>Timezone</Label>
            <Combobox
              id='appointment-type-timezone'
              options={COMMON_TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
              value={timezone}
              onValueChange={(v) => {
                setTimezone(v);
                invalidateAvailability();
              }}
              placeholder='Select timezone'
              searchPlaceholder='Search timezones…'
            />
          </VStack>

          {/* Suggestions */}
          {selectedAppointmentType && (
            <VStack gap={2}>
              <HStack gap={2} align='center' justify='between'>
                <Text size='sm' weight='medium'>
                  Suggested times
                </Text>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => void handleLoadSuggestions()}
                  disabled={isPending}
                >
                  Find times
                </Button>
              </HStack>
              {suggestions.length > 0 && (
                <HStack gap={2} wrap>
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
          {selectedAppointmentType && (
            <Button
              type='button'
              variant='secondary'
              onClick={() => void handleCheckAvailability()}
              disabled={isPending}
            >
              {isPending ? 'Checking…' : 'Check availability'}
            </Button>
          )}

          {/* Unsatisfiable warning */}
          {unsatisfiable && (
            // TODO(ds-gap): Alert has no `warning` variant — see above.
            <Alert
              className='border-warning bg-background'
              data-testid='unsatisfiable-alert'
            >
              <Icon icon={TriangleAlert} color='warning' />
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
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              data-testid='appointment-type-book-submit'
            >
              {isPending ? 'Booking…' : 'Book appointment type'}
            </Button>
          </DialogFooter>
        </VStack>
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
        <Text size='sm' weight='medium'>
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
              <Label
                htmlFor={`slot-${view.slotId}-cal-${cal.id}`}
                // shadcn internal: Label takes no token props, and
                // user-select / cursor have no design-system equivalent.
                className={cn(
                  'select-none',
                  isFree ? 'cursor-pointer' : 'text-muted-foreground'
                )}
              >
                {cal.name}
                {!isFree ? ' · busy' : ''}
              </Label>
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
