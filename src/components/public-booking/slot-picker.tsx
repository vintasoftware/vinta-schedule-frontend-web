'use client';

/**
 * SlotPicker — renders `BookableSlotProposal[]` as a month calendar (only
 * days that actually have a proposal are selectable) plus a time list for
 * the selected day, and reports the chosen proposal back to the caller.
 *
 * Replaces an earlier version that flattened every proposal into one long
 * `RadioGroup` — at business hours and 30-minute granularity that was
 * routinely ~200 rows in a single scroll, the first screen an external
 * attendee sees. The day grid is the `Calendar` design-system atom (a
 * `react-day-picker` wrapper); the time-of-day choice is still a
 * `RadioGroup`, now scoped to one day's proposals instead of the whole
 * search window.
 *
 * TIMEZONE — this is where the attendee reads AND changes it, not after
 * they've already picked a time. `onTimezoneChange`, when supplied, renders
 * a compact zone switcher right above the time list, so the zone the times
 * are shown in is never a fact the attendee has to go back to fix (see the
 * polish pass's "the timezone is invisible exactly where it matters"
 * finding). Every caller wires this to the SAME `timezone` state it also
 * passes to the write — see `public-booking-flow.tsx` et al.
 *
 * LOAD-BEARING: `proposalDurationMinutes` derives the displayed length from
 * the proposal's OWN `start_time`/`end_time`, never from a duration the
 * caller requested. An appointment-type-scoped code's pinned duration silently overrides
 * the request with no error (see the plan's "Read the duration off the
 * proposals, never off local state" guiding decision) — a picker that
 * echoed the requested duration back would misreport every pinned proposal.
 * This is the one function the flow-level regression tests
 * (`public-booking-flow.test.tsx`, `public-appointment-type-booking-flow.test.tsx`)
 * exercise directly. `uniformDurationMinutes` may CONSOLIDATE the per-row
 * "30 min" into one line when every proposal on the visible day shares a
 * length, but it is computed off that same per-proposal span — never off a
 * requested/local duration — and returns `null` (falling back to per-row
 * rendering) the moment the day's proposals disagree, so a mixed-duration
 * day is never misreported as uniform.
 */

import * as React from 'react';
import {
  RadioGroup,
  RadioGroupItem,
} from 'vinta-schedule-design-system/ui/radio-group';
import { Label } from 'vinta-schedule-design-system/ui/label';
import { Skeleton } from 'vinta-schedule-design-system/ui/skeleton';
import {
  Calendar,
  CalendarDayButton,
} from 'vinta-schedule-design-system/ui/calendar';
import { Combobox } from 'vinta-schedule-design-system/ui/combobox';
import { HStack, Text, VStack } from 'vinta-schedule-design-system/layout';
import { cn } from '@/lib/utils';
import type { BookableSlotProposal } from '@/client';
import { DateTime, zonedFormat } from '@/lib/datetime/index';
import {
  timezoneOptions,
  timezoneDisplayLabel,
} from '@/lib/booking-links/timezone-options';

/** Stable identity for a proposal — the API returns no id, only the range. */
export function proposalKey(proposal: BookableSlotProposal): string {
  return `${proposal.start_time}__${proposal.end_time}`;
}

/**
 * Minutes between a proposal's own `start_time`/`end_time`. See the module
 * doc comment — this must never read a requested/local duration instead.
 * Returns 0 for an unparsable range rather than throwing (a picker still
 * renders the time even if the duration line is degraded).
 */
export function proposalDurationMinutes(
  proposal: BookableSlotProposal
): number {
  const start = DateTime.fromISO(proposal.start_time);
  const end = DateTime.fromISO(proposal.end_time);
  if (!start.isValid || !end.isValid) return 0;
  const minutes = end.diff(start, 'minutes').minutes;
  return minutes > 0 ? Math.round(minutes) : 0;
}

/**
 * The shared length of EVERY proposal in `proposals`, or `null` the moment
 * any two disagree (including a 0-minute/unparsable one) — the signal a
 * caller uses to decide whether "30 min" can be stated once instead of
 * repeated on every row. Never lies: mixed spans always fall back to `null`
 * so the per-row rendering (which is always individually correct) takes
 * over.
 */
export function uniformDurationMinutes(
  proposals: BookableSlotProposal[]
): number | null {
  if (proposals.length === 0) return null;
  const [first, ...rest] = proposals;
  const minutes = proposalDurationMinutes(first);
  if (minutes <= 0) return null;
  const allSame = rest.every((p) => proposalDurationMinutes(p) === minutes);
  return allSame ? minutes : null;
}

/** The proposal's calendar day, as a `yyyy-MM-dd` key in `timezone` — the
 * grouping key for the day grid. Two proposals on the same wall-clock day
 * in `timezone` share a key even if their UTC dates differ. */
function proposalDayKey(
  proposal: BookableSlotProposal,
  timezone: string
): string | null {
  const start = DateTime.fromISO(proposal.start_time, { zone: timezone });
  return start.isValid ? start.toISODate() : null;
}

/**
 * `yyyy-MM-dd` -> a plain local `Date` used ONLY as `react-day-picker`
 * coordinate space (year/month/day matched via local getters, never
 * `toISOString()`/UTC). The calendar never does real timezone math — the
 * `timezone` prop's conversion already happened in `proposalDayKey`; from
 * here on a day is just three integers.
 */
function dayKeyToDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Inverse of `dayKeyToDate` — local getters only, see that function's note. */
function dateToDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface SlotPickerProps {
  proposals: BookableSlotProposal[];
  /** IANA zone the proposal times are rendered in. */
  timezone: string;
  selectedSlot: BookableSlotProposal | null;
  onSelect: (proposal: BookableSlotProposal) => void;
  isLoading?: boolean;
  /**
   * Lets the attendee change the zone right where they're reading times.
   * Omitted only by the isolated unit-test harness — every real caller
   * wires this to the same `timezone` state it renders with.
   */
  onTimezoneChange?: (timezone: string) => void;
}

export function SlotPicker({
  proposals,
  timezone,
  selectedSlot,
  onSelect,
  isLoading = false,
  onTimezoneChange,
}: SlotPickerProps) {
  // Memoized on `proposals`/`timezone` (not recomputed on every render) so
  // `SlotPickerCalendar`'s own `availableDaySet` memo — keyed on
  // `availableDayKeys` by reference — actually hits instead of recomputing
  // every time this array would otherwise be a fresh literal.
  const { byDay, availableDayKeys } = React.useMemo(() => {
    const grouped = new Map<string, BookableSlotProposal[]>();
    for (const proposal of proposals) {
      const key = proposalDayKey(proposal, timezone);
      if (!key) continue; // unparsable range — dropped rather than crashing the grid
      const existing = grouped.get(key);
      if (existing) existing.push(proposal);
      else grouped.set(key, [proposal]);
    }
    for (const dayProposals of grouped.values()) {
      dayProposals.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return {
      byDay: grouped,
      availableDayKeys: Array.from(grouped.keys()).sort(),
    };
  }, [proposals, timezone]);

  if (isLoading) {
    return (
      <VStack gap={2} data-testid='slot-picker-loading'>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className='h-14 w-full' />
        ))}
      </VStack>
    );
  }

  if (proposals.length === 0) {
    return (
      <Text size='sm' color='muted-foreground' data-testid='slot-picker-empty'>
        No bookable times are available in this window.
      </Text>
    );
  }

  if (availableDayKeys.length === 0) {
    // Every proposal had an unparsable range — degrade like the empty state
    // rather than rendering a calendar with nothing selectable.
    return (
      <Text size='sm' color='muted-foreground' data-testid='slot-picker-empty'>
        No bookable times are available in this window.
      </Text>
    );
  }

  return (
    <SlotPickerCalendar
      // Remounts (and re-derives its initial selected day) only when the SET
      // of bookable days actually changes — e.g. a `SLOT_UNAVAILABLE` retry
      // refetching an entirely different window. Untouched by a proposal
      // list that reshuffles times within the same days.
      key={availableDayKeys.join('|')}
      byDay={byDay}
      availableDayKeys={availableDayKeys}
      timezone={timezone}
      selectedSlot={selectedSlot}
      onSelect={onSelect}
      onTimezoneChange={onTimezoneChange}
    />
  );
}

interface SlotPickerCalendarProps {
  byDay: Map<string, BookableSlotProposal[]>;
  availableDayKeys: string[];
  timezone: string;
  selectedSlot: BookableSlotProposal | null;
  onSelect: (proposal: BookableSlotProposal) => void;
  onTimezoneChange?: (timezone: string) => void;
}

// Derived from `Calendar`'s own prop type rather than importing
// `react-day-picker` directly — `calendar.tsx` is the ONLY file in the repo
// allowed to import that package (see its doc comment); every other
// consumer, this one included, only ever needs the shape of its props.
type CalendarComponents = NonNullable<
  React.ComponentProps<typeof Calendar>['components']
>;
type CalendarDayButtonProps = Parameters<
  NonNullable<CalendarComponents['DayButton']>
>[0];

/**
 * An available (selectable) day gets a small dot below the date, in
 * addition to the plain/disabled contrast the base `CalendarDayButton`
 * already renders — so "you can pick this day" survives greyscale and
 * doesn't rely on the enabled/disabled color contrast alone. Paired with
 * the legend text `SlotPickerCalendar` renders below the grid.
 */
function AvailableDayButton(props: CalendarDayButtonProps) {
  const isAvailable = !props.modifiers.disabled && !props.modifiers.outside;
  // The selected day fills the button with the primary color, so the dot
  // needs to flip to the foreground-on-primary token there to stay visible
  // instead of blending into the fill.
  const dotColorClass = props.modifiers.selected
    ? 'bg-primary-foreground'
    : 'bg-primary';
  return (
    <div className='relative h-full w-full'>
      <CalendarDayButton {...props} />
      {isAvailable ? (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full',
            dotColorClass
          )}
        />
      ) : null}
    </div>
  );
}

function SlotPickerCalendar({
  byDay,
  availableDayKeys,
  timezone,
  selectedSlot,
  onSelect,
  onTimezoneChange,
}: SlotPickerCalendarProps) {
  const availableDaySet = React.useMemo(
    () => new Set(availableDayKeys),
    [availableDayKeys]
  );

  const [selectedDay, setSelectedDay] = React.useState<string>(() => {
    if (selectedSlot) {
      const key = proposalDayKey(selectedSlot, timezone);
      if (key && availableDaySet.has(key)) return key;
    }
    return availableDayKeys[0];
  });

  const dayProposals = byDay.get(selectedDay) ?? [];
  const selectedKey = selectedSlot ? proposalKey(selectedSlot) : undefined;
  const dayLabel = zonedFormat(
    dayProposals[0]?.start_time,
    timezone,
    'MMM d, yyyy'
  );
  // `null` the moment the day's proposals disagree — see that function's
  // doc comment. Only ever hides the per-row minutes when it's non-null.
  const dayUniformMinutes = uniformDurationMinutes(dayProposals);

  const timezoneComboboxOptions = React.useMemo(() => timezoneOptions(), []);

  return (
    <VStack gap={4} data-testid='slot-picker'>
      <VStack gap={2}>
        <Text size='sm' weight='medium' id='slot-picker-day-label'>
          Choose a date
        </Text>
        <Calendar
          mode='single'
          // `aria-labelledby` on `<Calendar>` only reaches DayPicker's Root
          // wrapper (a plain, roleless `<div>`) — the interactive
          // `role="grid"` element computes its OWN `aria-label` from
          // `labelGrid` (month/year only, e.g. "March 2026") regardless, so
          // an `aria-labelledby` here would silently do nothing for a screen
          // reader. `labels.labelGrid` is the supported hook that actually
          // reaches the grid's accessible name.
          labels={{
            labelGrid: (date) =>
              `Choose a date, ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          }}
          components={{ DayButton: AvailableDayButton }}
          selected={dayKeyToDate(selectedDay)}
          defaultMonth={dayKeyToDate(selectedDay)}
          onSelect={(date) => {
            if (!date) return;
            const key = dateToDayKey(date);
            if (availableDaySet.has(key)) setSelectedDay(key);
          }}
          disabled={(date) => !availableDaySet.has(dateToDayKey(date))}
          data-testid='slot-picker-calendar'
        />
        <Text size='xs' color='muted-foreground'>
          Days marked with a dot have available times.
        </Text>
      </VStack>

      <VStack gap={2}>
        <Text size='sm' weight='medium' id='slot-picker-time-label'>
          Available times for {dayLabel}
        </Text>

        <HStack gap={2} align='center' wrap>
          {onTimezoneChange ? (
            <>
              <Text size='xs' color='muted-foreground'>
                Times shown in:
              </Text>
              <Combobox
                id='slot-picker-timezone'
                options={timezoneComboboxOptions}
                value={timezone}
                onValueChange={onTimezoneChange}
                placeholder='Select timezone'
                searchPlaceholder='Search timezones…'
                aria-label='Change timezone'
                className='h-8 w-auto min-w-48 text-xs'
                data-testid='slot-picker-timezone-select'
              />
            </>
          ) : (
            <Text size='xs' color='muted-foreground'>
              Times shown in {timezoneDisplayLabel(timezone)}
            </Text>
          )}
        </HStack>

        {dayUniformMinutes !== null ? (
          <Text size='xs' color='muted-foreground'>
            {dayProposals.length > 1
              ? `${dayUniformMinutes} min each`
              : `${dayUniformMinutes} min`}
          </Text>
        ) : null}

        <RadioGroup
          value={selectedKey}
          onValueChange={(key) => {
            const match = dayProposals.find(
              (proposal) => proposalKey(proposal) === key
            );
            if (match) onSelect(match);
          }}
          aria-labelledby='slot-picker-time-label'
          data-testid='slot-picker-times'
        >
          {dayProposals.map((proposal) => {
            const key = proposalKey(proposal);
            const minutes = proposalDurationMinutes(proposal);
            const isSelected = key === selectedKey;
            return (
              <HStack
                key={key}
                gap={3}
                p={3}
                border
                radius='md'
                align='center'
                className={cn(
                  'transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-primary ring-1'
                    : 'hover:border-primary/50 hover:bg-accent/40'
                )}
                data-testid={`slot-option-${key}`}
              >
                <RadioGroupItem
                  value={key}
                  id={`slot-${key}`}
                  aria-label={`Book ${zonedFormat(proposal.start_time, timezone)}`}
                />
                <Label
                  htmlFor={`slot-${key}`}
                  className='flex flex-1 cursor-pointer flex-col'
                >
                  <Text weight='medium'>
                    {zonedFormat(proposal.start_time, timezone, 'h:mm a')}
                  </Text>
                  {dayUniformMinutes === null ? (
                    <Text size='sm' color='muted-foreground'>
                      {minutes} min
                    </Text>
                  ) : null}
                </Label>
              </HStack>
            );
          })}
        </RadioGroup>
      </VStack>
    </VStack>
  );
}
