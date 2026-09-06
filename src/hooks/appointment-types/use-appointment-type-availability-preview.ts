/**
 * useAppointmentTypeAvailabilityPreview — answers "which days does this calendar
 * actually come back free for this appointment type slot" over a picked date range
 * (Phase 6, spec UC-7).
 *
 * Windows, blocks, and quota rules are all intersect-only against a
 * calendar's base availability (see the handoff doc, section "Intersect-
 * only"): a save can succeed and still change nothing bookable, e.g. a
 * Saturday window on a calendar whose base availability excludes Saturday.
 * Without this preview an admin's only way to notice is to open the booking
 * dialog and simulate a booking. This hook answers the question directly by
 * reusing the SAME operation the booking flow already calls —
 * `appointmentTypesAvailabilityCreate` (see use-appointment-type-booking.ts's
 * `fetchSlotAvailability`).
 *
 * WHAT GETS PROBED, AND WHY IT ISN'T "THE WHOLE DAY":
 * The backend only answers "available" for a range fully covered by a
 * SINGLE `AvailableTime` span (see `window_fully_covered_by_spans` in the
 * backend's slot engine, and the managed-calendar availability queryset —
 * both require one row whose own start/end contain the whole queried
 * range). A calendar configured e.g. "Tuesdays and Thursdays 9am-5pm" has
 * no row spanning a full midnight-to-midnight day, so probing
 * `[00:00, 24:00)` gets "not free" back for EVERY day, including Tuesday
 * and Thursday — the exact opposite of the truth. Instead, this hook
 * derives each day's probed sub-range from this calendar's OWN
 * appointment-type-scoped windows for that date's weekday (`useAppointmentTypeScopedWindows`,
 * the same data `appointment-type-window-grid.tsx` renders as the weekday grid,
 * filtered here to the rows `classifyWindows` marks representable — the
 * same "weekly, single BYDAY" shape the grid itself round-trips). Probing a
 * declared window's own interval is exactly the shape the "fully covered by
 * one span" contract can answer, and a false-negative there — a window
 * declared but base hours not actually covering it — is the REAL
 * intersect-only signal this preview exists to surface.
 *
 * A day whose weekday has NO representable appointment-type-scoped window for this
 * calendar in this slot has no sub-range to derive at all — that day is
 * reported as `'unconfigured'` (base-availability fall-through, see
 * `appointment_type_service.py`'s `check_group_availability` docstring) and
 * is never queried, rather than running the doomed full-day probe.
 *
 * `use-appointment-type-booking.ts` is READ ONLY here, never modified — the booking
 * flow is a plan-level hands-off surface.
 *
 * LAZINESS IS A REQUIREMENT, NOT AN OPTIMIZATION: the appointment type detail page
 * already loads the appointment type, its slots, their rosters, and three concept
 * lists per calendar (see slot-roster.tsx). This hook must add nothing to
 * that cost until a caller explicitly opts in via `enabled` — see the
 * `enabled` param below and this module's test asserting the query does not
 * fire until then. The appointment-type-scoped windows list this hook also reads is
 * gated by the same `enabled` flag; in practice it's a cache hit (not a new
 * network request) because `appointment-type-window-grid.tsx` already loads the same
 * appointmentTypeId/slotId windows list for this page, but gating it here keeps that
 * an implementation detail this hook doesn't depend on.
 *
 * NOT COVERED BY THIS FIX: this hook's query key does not include the
 * windows themselves, so a concurrent edit to the grid while the preview
 * strip is already open (and already holding results) does not
 * automatically re-probe with the new window shape — the admin would need
 * to close and reopen the strip, or change the date range. Reacting to a
 * live window edit was out of scope for the fix this module addresses.
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { appointmentTypesAvailabilityCreate } from '@/client/sdk.gen';
import type { AppointmentTypeRangeAvailability } from '@/client';
import { DateTime } from '@/lib/datetime/index';
import { useAppointmentTypeScopedWindows } from './use-appointment-type-scoped-windows';
import {
  classifyWindows,
  weekdayMatrix,
  type BydayCode,
  type WeekdayWindow,
} from '@/components/appointment-types/appointment-type-scoped-types';

// A runaway range (e.g. a typo'd year) would otherwise build an unbounded
// request body — cap it rather than trust the caller's date inputs.
const MAX_DAYS = 366;

/** One sub-range to ask the backend about, in full ISO instants (with offset). */
export interface WindowProbeRange {
  startTime: string;
  endTime: string;
}

export interface DayPlan {
  /** `YYYY-MM-DD`, in the requested zone — the day this plan represents. */
  date: string;
  /**
   * One probe per representable appointment-type-scoped window whose weekday matches
   * this date, each spanning that window's own declared HH:mm interval on
   * THIS specific date. Empty when this calendar has no representable
   * appointment-type-scoped window for this weekday in this slot — see the module doc
   * comment for why that day is never queried.
   */
  probes: WindowProbeRange[];
}

export type DayPreviewStatus = 'free' | 'not-free' | 'unconfigured';

export interface DayAvailability {
  /** `YYYY-MM-DD`, matching the `DayPlan` it was computed from. */
  date: string;
  status: DayPreviewStatus;
}

/**
 * Splits `[startDate, endDate]` (inclusive, `YYYY-MM-DD`) into one `DayPlan`
 * per day, in `timezone`, each carrying the probe(s) derived from `windows`
 * (already filtered to representable rows for this calendar — see
 * `classifyWindows`). Returns `[]` for an invalid or inverted range (end
 * before start) rather than throwing — the caller (a date-range picker) can
 * easily produce a momentarily-invalid pair while the admin is still
 * editing it.
 */
export function buildDayPlans(
  startDate: string,
  endDate: string,
  timezone: string,
  windows: readonly WeekdayWindow[]
): DayPlan[] {
  const start = DateTime.fromISO(startDate, { zone: timezone }).startOf('day');
  const end = DateTime.fromISO(endDate, { zone: timezone }).startOf('day');
  if (!start.isValid || !end.isValid || end < start) return [];

  const matrix = weekdayMatrix();
  const plans: DayPlan[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < MAX_DAYS) {
    const date = cursor.toISODate();
    // toISODate() types as `string | null` — null only for an invalid
    // DateTime, which start/end already guard against above, but guard
    // again here defensively rather than assert non-null.
    if (date) {
      const byday = matrix[cursor.weekday - 1]?.byday as BydayCode | undefined;
      const matching = byday
        ? windows.filter((window) => window.weekday === byday)
        : [];
      const probes: WindowProbeRange[] = [];
      for (const window of matching) {
        const [startHour, startMinute] = window.startTime
          .split(':')
          .map((n) => Number.parseInt(n, 10));
        const [endHour, endMinute] = window.endTime
          .split(':')
          .map((n) => Number.parseInt(n, 10));
        const probeStart = cursor.set({
          hour: startHour,
          minute: startMinute,
          second: 0,
          millisecond: 0,
        });
        const probeEnd = cursor.set({
          hour: endHour,
          minute: endMinute,
          second: 0,
          millisecond: 0,
        });
        const startISO = probeStart.toISO();
        const endISO = probeEnd.toISO();
        if (startISO && endISO) {
          probes.push({ startTime: startISO, endTime: endISO });
        }
      }
      plans.push({ date, probes });
    }
    cursor = cursor.plus({ days: 1 });
    guard += 1;
  }
  return plans;
}

/**
 * Reduces the appointment type availability response onto `dayPlans`, answering
 * per-day whether `calendarId` comes back free for `slotId`.
 *
 * A day with no probes at all (no representable appointment-type-scoped window for
 * its weekday) reads as `'unconfigured'` without consulting `results` —
 * there was nothing to ask the backend. Otherwise a day is `'free'` when AT
 * LEAST ONE of its probes reports `calendarId` among the free candidates,
 * `'not-free'` when none do.
 *
 * Matches each probe to its response entry by exact start/end echo (the API
 * echoes the ranges it was asked about), falling back to positional
 * matching against the flattened probe list actually sent — same defensive
 * convention as use-appointment-type-booking.ts's `fetchSlotAvailability` — so a
 * normalized-echo mismatch (e.g. trailing `Z` vs. an offset) doesn't
 * silently produce a wrong answer.
 */
export function reduceAvailabilityToDays(
  dayPlans: readonly DayPlan[],
  results: readonly AppointmentTypeRangeAvailability[],
  slotId: number,
  calendarId: number
): DayAvailability[] {
  const flatProbes = dayPlans.flatMap((day) => day.probes);
  return dayPlans.map((day) => {
    if (day.probes.length === 0) {
      return { date: day.date, status: 'unconfigured' };
    }
    const isFree = day.probes.some((probe) => {
      const positionalIndex = flatProbes.indexOf(probe);
      const match =
        results.find(
          (r) =>
            r.start_time === probe.startTime && r.end_time === probe.endTime
        ) ?? results[positionalIndex];
      const slot = match?.slots.find((s) => s.slot_id === slotId);
      return slot?.available_calendar_ids.includes(calendarId) ?? false;
    });
    return { date: day.date, status: isFree ? 'free' : 'not-free' };
  });
}

export interface AppointmentTypeAvailabilityPreviewQueryKeyParams {
  appointmentTypeId: number;
  slotId: number;
  calendarId: number;
  startDate: string;
  endDate: string;
  timezone: string;
}

/**
 * Manual query key — `appointmentTypesAvailabilityCreate` is a POST-shaped
 * "create" operation, so hey-api only generates a `*Mutation` factory for
 * it, no `*Options`/query-key factory (see use-appointment-type-booking.ts, which calls
 * the same operation imperatively for the same reason). Exported so
 * Storybook stories can seed the exact cache entry this hook reads from
 * (`QueryClient#setQueryData`), the same convention
 * appointment-type-block-list.stories.tsx uses with a generated `*Options` factory's
 * `.queryKey`.
 */
export function appointmentTypeAvailabilityPreviewQueryKey({
  appointmentTypeId,
  slotId,
  calendarId,
  startDate,
  endDate,
  timezone,
}: AppointmentTypeAvailabilityPreviewQueryKeyParams): readonly unknown[] {
  return [
    'appointment-type-availability-preview',
    appointmentTypeId,
    slotId,
    calendarId,
    startDate,
    endDate,
    timezone,
  ];
}

export interface UseAppointmentTypeAvailabilityPreviewOptions {
  appointmentTypeId: number;
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

export function useAppointmentTypeAvailabilityPreview({
  appointmentTypeId,
  slotId,
  calendarId,
  startDate,
  endDate,
  timezone,
  enabled,
}: UseAppointmentTypeAvailabilityPreviewOptions) {
  const windowsResult = useAppointmentTypeScopedWindows({
    appointmentTypeId,
    slotId,
    calendarId,
    enabled,
  });

  const representableWindows = React.useMemo(
    () => classifyWindows(windowsResult.windows).representable,
    [windowsResult.windows]
  );

  const dayPlans = React.useMemo(
    () => buildDayPlans(startDate, endDate, timezone, representableWindows),
    [startDate, endDate, timezone, representableWindows]
  );

  const probeRanges = React.useMemo(
    () => dayPlans.flatMap((day) => day.probes),
    [dayPlans]
  );

  const query = useQuery({
    queryKey: appointmentTypeAvailabilityPreviewQueryKey({
      appointmentTypeId,
      slotId,
      calendarId,
      startDate,
      endDate,
      timezone,
    }),
    queryFn: async (): Promise<AppointmentTypeRangeAvailability[]> => {
      const result = await appointmentTypesAvailabilityCreate({
        path: { id: String(appointmentTypeId) },
        body: {
          ranges: probeRanges.map((probe) => ({
            start_time: probe.startTime,
            end_time: probe.endTime,
          })),
        },
      });
      return result.data?.results ?? [];
    },
    // Waits for the windows list to resolve (so `probeRanges` reflects real
    // data, not the empty-before-load default) and skips entirely when
    // there is nothing to probe -- either an invalid/inverted picked range,
    // or every day in range being unconfigured for this calendar/slot.
    enabled: enabled && !windowsResult.isLoading && probeRanges.length > 0,
  });

  const days = React.useMemo(
    () =>
      reduceAvailabilityToDays(dayPlans, query.data ?? [], slotId, calendarId),
    [dayPlans, query.data, slotId, calendarId]
  );

  return {
    days,
    /** True when at least one day in the range is free — drives the empty state. */
    hasAnyFreeDay: days.some((day) => day.status === 'free'),
    isLoading: windowsResult.isLoading || query.isLoading,
    isFetching: windowsResult.windowsQuery.isFetching || query.isFetching,
    isError: windowsResult.isError || query.isError,
    error: windowsResult.error ?? query.error,
    refetch: () => {
      void windowsResult.windowsQuery.refetch();
      void query.refetch();
    },
    query,
  };
}
