/**
 * useAvailabilityCheck — check whether a time range is free on a calendar.
 *
 * Calls calendarUnavailableWindowsList for the given range. If any unavailable
 * window overlaps the range, the range is considered conflicted. The hook also
 * surfaces the nearest available window by querying calendarAvailableWindowsList.
 *
 * This is an imperative check (not a live query) because it is triggered on
 * form submit, not on every render. It returns a function checkAvailability
 * that resolves to an AvailabilityResult.
 *
 * Why unavailable windows over available windows for conflict detection:
 * unavailable windows directly represent blocks (blocked times, busy events);
 * any overlap with the proposed range is a conflict. Available windows are the
 * inverse and would require set-difference logic.
 */

import {
  calendarAvailableWindowsList,
  calendarUnavailableWindowsList,
} from '@/client/sdk.gen';
import type { AvailableTimeWindow, UnavailableTimeWindow } from '@/client';
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvailabilityCheckParams {
  /** Calendar id (numeric) — passed as path id (string) to the API. */
  calendarId: number;
  /** ISO datetime string for range start, e.g. "2024-06-15T09:00:00-04:00" */
  startDatetime: string;
  /** ISO datetime string for range end, e.g. "2024-06-15T10:00:00-04:00" */
  endDatetime: string;
}

export interface AvailabilityResult {
  /** True if the range has no conflicting unavailable windows. */
  isFree: boolean;
  /** Unavailable windows overlapping the proposed range. */
  conflictingWindows: UnavailableTimeWindow[];
  /**
   * The first available window after the conflict (nearest free slot).
   * Null when there are no available windows after the range start.
   */
  nearestFreeWindow: AvailableTimeWindow | null;
  /** Calendar id this result belongs to. */
  calendarId: number;
}

// ---------------------------------------------------------------------------
// checkAvailabilityForCalendar
//
// Standalone async function (not a hook) so it can be called imperatively in
// form submit handlers. Exported for testing without a React context.
// ---------------------------------------------------------------------------

export async function checkAvailabilityForCalendar(
  params: AvailabilityCheckParams
): Promise<AvailabilityResult> {
  const { calendarId, startDatetime, endDatetime } = params;
  const idStr = String(calendarId);

  // Fetch unavailable windows for the proposed range.
  const unavailableResult = await calendarUnavailableWindowsList({
    path: { id: idStr },
    query: {
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      limit: 50,
    },
  });

  const conflictingWindows: UnavailableTimeWindow[] =
    unavailableResult.data?.results ?? [];
  const isFree = conflictingWindows.length === 0;

  // Fetch the nearest available window AFTER the requested range.
  // We query from the range end forward (+7 days) so we find the next free slot,
  // not a window inside the conflict window (which would always be empty).
  let nearestFreeWindow: AvailableTimeWindow | null = null;
  try {
    const searchStart = endDatetime;
    const searchEnd = DateTime.fromISO(endDatetime).plus({ days: 7 }).toISO()!;
    const availableResult = await calendarAvailableWindowsList({
      path: { id: idStr },
      query: {
        start_datetime: searchStart,
        end_datetime: searchEnd,
        limit: 5,
      },
    });
    const windows = availableResult.data?.results ?? [];
    nearestFreeWindow = windows[0] ?? null;
  } catch {
    // If the available-windows call fails, we still have conflict info —
    // nearestFreeWindow stays null; not fatal.
  }

  return { isFree, conflictingWindows, nearestFreeWindow, calendarId };
}

// ---------------------------------------------------------------------------
// useAvailabilityCheck
//
// Hook wrapper that exposes checkAvailabilityForCalendar as a stable function
// reference. Also handles checking multiple calendars in parallel.
// ---------------------------------------------------------------------------

export function useAvailabilityCheck() {
  /**
   * Check availability for a single calendar.
   */
  const checkCalendar = (
    params: AvailabilityCheckParams
  ): Promise<AvailabilityResult> => checkAvailabilityForCalendar(params);

  /**
   * Check availability for multiple calendars in parallel.
   * Returns an array of results (one per calendar) preserving input order.
   * Errors per-calendar are caught and surfaced as a full-conflict result.
   */
  const checkCalendars = async (
    calendarIds: number[],
    startDatetime: string,
    endDatetime: string
  ): Promise<AvailabilityResult[]> => {
    return Promise.all(
      calendarIds.map((calendarId) =>
        checkAvailabilityForCalendar({
          calendarId,
          startDatetime,
          endDatetime,
        }).catch(
          (): AvailabilityResult => ({
            isFree: false,
            conflictingWindows: [],
            nearestFreeWindow: null,
            calendarId,
          })
        )
      )
    );
  };

  return { checkCalendar, checkCalendars };
}
