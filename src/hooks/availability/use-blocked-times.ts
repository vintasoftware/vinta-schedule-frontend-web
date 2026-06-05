/**
 * useBlockedTimes — data hook for blocked-time windows.
 *
 * Op mapping:
 *  - ONE-OFF (non-recurring, specific date): use `blockedTimesCreate`
 *    (POST /blocked-times/) with start_time/end_time + optional reason.
 *    Alternatively, use `blockedTimesBulkCreateCreate`
 *    (POST /blocked-times/bulk-create/) for consistency with AvailableTimes.
 *
 *  - RECURRING patterns: use `blockedTimesBulkCreateCreate` with `rrule_string`
 *    set to an RRULE (e.g. "FREQ=WEEKLY;BYDAY=MO,WE" or "FREQ=DAILY").
 *    The backend stores these as recurring BlockedTime objects.
 *
 * Both one-off and recurring operations share:
 *   POST /blocked-times/bulk-create/
 *   Body: { blocked_times: BlockedTimeWritable[] }
 *
 * The `blockedTimesCreateExceptionCreate` (POST /blocked-times/{id}/create-exception/)
 * is for modifying/cancelling specific occurrences of an EXISTING recurring
 * series. It is NOT used here because Phase 26 focuses on creation only.
 *
 * Cache invalidation:
 *   Both mutations invalidate all `blockedTimesList` queries after success so
 *   any list/availability view re-fetches and reflects the saved state (marking
 *   the member as busy in the availability window).
 */

import {
  blockedTimesListOptions,
  blockedTimesListQueryKey,
  blockedTimesBulkCreateCreateMutation,
} from '@/client/@tanstack/react-query.gen';
import type { BlockedTimeWritable, BulkBlockedTimeWritable } from '@/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Query key — exported so other mutations can invalidate it.
// ---------------------------------------------------------------------------

export const BLOCKED_TIMES_QUERY_KEY = blockedTimesListQueryKey();

// ---------------------------------------------------------------------------
// useBlockedTimes
// ---------------------------------------------------------------------------

export function useBlockedTimes() {
  const queryClient = useQueryClient();

  // ---- Read ----------------------------------------------------------------
  const blockedTimesQuery = useQuery(blockedTimesListOptions());

  const blockedTimes = blockedTimesQuery.data?.results ?? [];

  // ---- Bulk-create mutation ------------------------------------------------
  // Used for BOTH recurring patterns and one-off date windows.
  // The distinction is driven by the caller: recurring entries include `rrule_string`
  // (FREQ=WEEKLY;BYDAY=...) while one-off entries omit it.
  const bulkCreateMutation = useMutation({
    ...blockedTimesBulkCreateCreateMutation(),
    onSuccess: () => {
      // Invalidate all blocked-times list queries so the editor re-fetches.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'blockedTimesList',
      });
    },
  });

  /**
   * Create one-off blocked times (single event on a specific date).
   *
   * @param startDatetime - ISO datetime string (e.g. "2025-06-15T09:00:00")
   * @param endDatetime - ISO datetime string (e.g. "2025-06-15T10:00:00")
   * @param timezone - IANA timezone name (e.g. "America/New_York")
   * @param reason - optional reason for the blocked time
   * @param calendarId - optional calendar id to associate the blocked time with
   *
   * Throws on API error so callers can catch and display a toast.
   */
  const createBlockedTime = async (
    startDatetime: string,
    endDatetime: string,
    timezone: string,
    reason?: string,
    calendarId?: number | null
  ): Promise<void> => {
    const blockedTime: BlockedTimeWritable = {
      start_time: startDatetime,
      end_time: endDatetime,
      timezone,
      ...(reason !== undefined ? { reason } : {}),
      calendar: calendarId ?? null,
    };
    const body: BulkBlockedTimeWritable = { blocked_times: [blockedTime] };
    await bulkCreateMutation.mutateAsync({ body });
  };

  /**
   * Create recurring blocked times with an RRULE.
   *
   * @param startTime - time string on an arbitrary anchor date (e.g. "09:00:00")
   * @param endTime - time string on the same anchor date (e.g. "10:00:00")
   * @param timezone - IANA timezone name
   * @param rruleString - RFC-5545 RRULE string (e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR")
   * @param reason - optional reason for the blocked times
   * @param calendarId - optional calendar id to associate the blocked times with
   *
   * The startTime/endTime are treated as times-of-day that repeat according to
   * the RRULE. The date portion of the start/end times does not matter for
   * recurring patterns; only the time component is used by the backend.
   *
   * Throws on API error so callers can catch and display a toast.
   */
  const createRecurringBlockedTime = async (
    startTime: string,
    endTime: string,
    timezone: string,
    rruleString: string,
    reason?: string,
    calendarId?: number | null
  ): Promise<void> => {
    const blockedTime: BlockedTimeWritable = {
      start_time: startTime,
      end_time: endTime,
      timezone,
      rrule_string: rruleString,
      ...(reason !== undefined ? { reason } : {}),
      calendar: calendarId ?? null,
    };
    const body: BulkBlockedTimeWritable = { blocked_times: [blockedTime] };
    await bulkCreateMutation.mutateAsync({ body });
  };

  return {
    // Query state
    blockedTimes,
    isLoading: blockedTimesQuery.isLoading,
    isError: blockedTimesQuery.isError,
    error: blockedTimesQuery.error,
    blockedTimesQuery,

    // Mutations
    createBlockedTime,
    createRecurringBlockedTime,
    bulkCreateMutation,
    isPending: bulkCreateMutation.isPending,
  };
}
