/**
 * useGroupAvailabilityPreview — answers "which days does this calendar
 * actually come back free for this group slot" over a picked date range
 * (Phase 6, spec UC-7).
 *
 * Windows, blocks, and quota rules are all intersect-only against a
 * calendar's base availability (see the handoff doc, section "Intersect-
 * only"): a save can succeed and still change nothing bookable, e.g. a
 * Saturday window on a calendar whose base availability excludes Saturday.
 * Without this preview an admin's only way to notice is to open the booking
 * dialog and simulate a booking. This hook answers the question directly by
 * reusing the SAME operation the booking flow already calls —
 * `calendarGroupsAvailabilityCreate` (see use-group-booking.ts's
 * `fetchSlotAvailability`) — over one range PER DAY in the picked range,
 * rather than a single range covering the whole picked window. A single
 * whole-range query would only ever answer "is this calendar free for the
 * ENTIRE range at once", which collapses every multi-day range to "no" the
 * moment any one day in it isn't free; per-day ranges are what makes a
 * per-day answer possible.
 *
 * `use-group-booking.ts` is READ ONLY here, never modified — the booking
 * flow is a plan-level hands-off surface.
 *
 * LAZINESS IS A REQUIREMENT, NOT AN OPTIMIZATION: the group detail page
 * already loads the group, its slots, their rosters, and three concept
 * lists per calendar (see slot-roster.tsx). This hook must add nothing to
 * that cost until a caller explicitly opts in via `enabled` — see the
 * `enabled` param below and this module's test asserting the query does not
 * fire until then.
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { calendarGroupsAvailabilityCreate } from '@/client/sdk.gen';
import type { CalendarGroupRangeAvailability } from '@/client';
import { DateTime } from '@/lib/datetime/index';

// A range covering an entire calendar day, in the IANA zone the caller asked
// for. `startTime`/`endTime` are full ISO instants (with offset), the shape
// `calendarGroupsAvailabilityCreate`'s `ranges` body expects.
export interface DayRange {
  /** `YYYY-MM-DD`, in the requested zone — the day this range represents. */
  date: string;
  startTime: string;
  endTime: string;
}

export interface DayAvailability {
  /** `YYYY-MM-DD`, matching the `DayRange` it was computed from. */
  date: string;
  /** True when `calendarId` is among the slot's free candidates for this day. */
  isFree: boolean;
}

// A runaway range (e.g. a typo'd year) would otherwise build an unbounded
// request body — cap it rather than trust the caller's date inputs.
const MAX_DAYS = 366;

/**
 * Splits `[startDate, endDate]` (inclusive, `YYYY-MM-DD`) into one full-day
 * range per day, in `timezone`. Returns `[]` for an invalid or inverted
 * range (end before start) rather than throwing — the caller (a date-range
 * picker) can easily produce a momentarily-invalid pair while the admin is
 * still editing it.
 */
export function buildDayRanges(
  startDate: string,
  endDate: string,
  timezone: string
): DayRange[] {
  const start = DateTime.fromISO(startDate, { zone: timezone }).startOf('day');
  const end = DateTime.fromISO(endDate, { zone: timezone }).startOf('day');
  if (!start.isValid || !end.isValid || end < start) return [];

  const ranges: DayRange[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < MAX_DAYS) {
    const dayEnd = cursor.plus({ days: 1 });
    const startISO = cursor.toISO();
    const endISO = dayEnd.toISO();
    const date = cursor.toISODate();
    // toISO()/toISODate() type as `string | null` — null only for an
    // invalid DateTime, which start/end already guard against above, but
    // guard again here defensively rather than assert non-null.
    if (startISO && endISO && date) {
      ranges.push({ date, startTime: startISO, endTime: endISO });
    }
    cursor = dayEnd;
    guard += 1;
  }
  return ranges;
}

/**
 * Reduces the group availability response onto `dayRanges`, answering
 * per-day whether `calendarId` is among `slotId`'s free candidates.
 *
 * Matches each day range to its response entry by exact start/end echo
 * (the API echoes the ranges it was asked about), falling back to positional
 * matching — same defensive convention as use-group-booking.ts's
 * `fetchSlotAvailability` — so a normalized-echo mismatch (e.g. trailing `Z`
 * vs. an offset) doesn't silently produce a wrong answer.
 *
 * A day the response has no matching entry for, or whose entry doesn't
 * mention `slotId` at all, reads as NOT free — same "unmentioned slot means
 * zero free calendars" convention as `buildSlotAvailability`.
 */
export function reduceAvailabilityToDays(
  dayRanges: readonly DayRange[],
  results: readonly CalendarGroupRangeAvailability[],
  slotId: number,
  calendarId: number
): DayAvailability[] {
  return dayRanges.map((range, index) => {
    const match =
      results.find(
        (r) => r.start_time === range.startTime && r.end_time === range.endTime
      ) ?? results[index];
    const slot = match?.slots.find((s) => s.slot_id === slotId);
    const isFree = slot?.available_calendar_ids.includes(calendarId) ?? false;
    return { date: range.date, isFree };
  });
}

export interface GroupAvailabilityPreviewQueryKeyParams {
  groupId: number;
  slotId: number;
  calendarId: number;
  startDate: string;
  endDate: string;
  timezone: string;
}

/**
 * Manual query key — `calendarGroupsAvailabilityCreate` is a POST-shaped
 * "create" operation, so hey-api only generates a `*Mutation` factory for
 * it, no `*Options`/query-key factory (see use-group-booking.ts, which calls
 * the same operation imperatively for the same reason). Exported so
 * Storybook stories can seed the exact cache entry this hook reads from
 * (`QueryClient#setQueryData`), the same convention
 * group-block-list.stories.tsx uses with a generated `*Options` factory's
 * `.queryKey`.
 */
export function groupAvailabilityPreviewQueryKey({
  groupId,
  slotId,
  calendarId,
  startDate,
  endDate,
  timezone,
}: GroupAvailabilityPreviewQueryKeyParams): readonly unknown[] {
  return [
    'group-availability-preview',
    groupId,
    slotId,
    calendarId,
    startDate,
    endDate,
    timezone,
  ];
}

export interface UseGroupAvailabilityPreviewOptions {
  groupId: number;
  slotId: number;
  calendarId: number;
  /** Inclusive, `YYYY-MM-DD`. */
  startDate: string;
  /** Inclusive, `YYYY-MM-DD`. */
  endDate: string;
  /** IANA zone the per-day ranges are computed in. */
  timezone: string;
  /**
   * The strip this hook feeds is collapsed by default (spec: "a read-only
   * addition to the existing panel" that must not change the panel's
   * default cost) — set this to `true` only once the caller has explicitly
   * opened it. Defaults to `false` so an accidental omission fails closed
   * (no request), not open.
   */
  enabled: boolean;
}

export function useGroupAvailabilityPreview({
  groupId,
  slotId,
  calendarId,
  startDate,
  endDate,
  timezone,
  enabled,
}: UseGroupAvailabilityPreviewOptions) {
  const dayRanges = React.useMemo(
    () => buildDayRanges(startDate, endDate, timezone),
    [startDate, endDate, timezone]
  );

  const query = useQuery({
    queryKey: groupAvailabilityPreviewQueryKey({
      groupId,
      slotId,
      calendarId,
      startDate,
      endDate,
      timezone,
    }),
    queryFn: async (): Promise<CalendarGroupRangeAvailability[]> => {
      const result = await calendarGroupsAvailabilityCreate({
        path: { id: String(groupId) },
        body: {
          ranges: dayRanges.map((range) => ({
            start_time: range.startTime,
            end_time: range.endTime,
          })),
        },
      });
      return result.data?.results ?? [];
    },
    // dayRanges.length === 0 guards an invalid/inverted picked range from
    // ever issuing a request with an empty `ranges` body.
    enabled: enabled && dayRanges.length > 0,
  });

  const days = React.useMemo(
    () =>
      reduceAvailabilityToDays(dayRanges, query.data ?? [], slotId, calendarId),
    [dayRanges, query.data, slotId, calendarId]
  );

  return {
    days,
    /** True when at least one day in the range is free — drives the empty state. */
    hasAnyFreeDay: days.some((day) => day.isFree),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    query,
  };
}
