/**
 * useUserAvailability — reactive free/busy query for a target calendar.
 *
 * Calls calendarAvailableWindowsList and calendarUnavailableWindowsList for
 * the requested calendarId + date range and returns the merged free/busy view.
 *
 * Privacy: this hook returns ONLY what the windows endpoints expose —
 * available/unavailable windows WITHOUT any event titles or private detail.
 * The AvailableTimeWindow type has { id, start_time, end_time, can_book_partially }
 * and UnavailableTimeWindow has { id, reason, start_time, end_time, reason_description }.
 * Neither type surfaces private calendar event titles.
 *
 * Colleague → Calendar resolution gap:
 * --------------------------------------------------------------------------
 * The OrganizationMembership read serializer (GET /organization-members/)
 * exposes only { id, role, is_active, user_email, user_first_name, user_last_name }.
 * It does NOT expose a calendar_id for the member.
 *
 * The calendarList endpoint (GET /calendar/) is caller-scoped — it returns
 * only the authenticated user's own calendars, not a colleague's.
 *
 * There is currently no API endpoint to map an org member (by email, user id,
 * or membership id) to their primary calendar id.
 *
 * Resolution strategy adopted for Phase 27:
 *   The component accepts a calendarId entered directly by the user. This is
 *   the only safe choice until the backend exposes a member → calendar mapping
 *   (e.g. an extended membership serializer or a lookup endpoint). When that
 *   API lands, this hook's interface (calendarId: string) remains unchanged;
 *   only the component needs to add auto-resolution from the picker.
 * --------------------------------------------------------------------------
 *
 * Query keys are disabled (enabled: false) when calendarId is empty or range
 * is incomplete so we avoid spurious 400 errors.
 */

import {
  calendarAvailableWindowsListOptions,
  calendarUnavailableWindowsListOptions,
} from '@/client/@tanstack/react-query.gen';
import type { AvailableTimeWindow, UnavailableTimeWindow } from '@/client';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateRange {
  /** ISO datetime string for the range start, e.g. "2025-06-01T00:00:00" */
  startDatetime: string;
  /** ISO datetime string for the range end, e.g. "2025-06-07T23:59:59" */
  endDatetime: string;
}

export interface UserAvailabilityResult {
  /** Free windows (times the calendar is explicitly available). */
  freeWindows: AvailableTimeWindow[];
  /** Busy windows (times the calendar is blocked/unavailable). */
  busyWindows: UnavailableTimeWindow[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// useUserAvailability
// ---------------------------------------------------------------------------

/**
 * Returns the free/busy windows for a calendar over the given date range.
 *
 * @param calendarId - numeric id of the target calendar (string form accepted
 *   because that's what the path param expects; pass "" or "0" to disable).
 * @param range - date range to query; pass null/undefined to disable queries.
 */
export function useUserAvailability(
  calendarId: string,
  range: DateRange | null
): UserAvailabilityResult {
  const enabled = Boolean(
    calendarId &&
    calendarId !== '0' &&
    range?.startDatetime &&
    range?.endDatetime
  );

  const freeQuery = useQuery({
    ...calendarAvailableWindowsListOptions({
      path: { id: calendarId || '0' },
      query: {
        start_datetime: range?.startDatetime ?? '',
        end_datetime: range?.endDatetime ?? '',
      },
    }),
    enabled,
  });

  const busyQuery = useQuery({
    ...calendarUnavailableWindowsListOptions({
      path: { id: calendarId || '0' },
      query: {
        start_datetime: range?.startDatetime ?? '',
        end_datetime: range?.endDatetime ?? '',
      },
    }),
    enabled,
  });

  // The endpoints return a bare array (200: Array<…>).
  const freeWindows: AvailableTimeWindow[] = freeQuery.data ?? [];
  const busyWindows: UnavailableTimeWindow[] = busyQuery.data ?? [];

  const isLoading = freeQuery.isLoading || busyQuery.isLoading;
  const isError = freeQuery.isError || busyQuery.isError;
  const error = (freeQuery.error ?? busyQuery.error) as Error | null;

  return {
    freeWindows,
    busyWindows,
    isLoading,
    isError,
    error,
  };
}
