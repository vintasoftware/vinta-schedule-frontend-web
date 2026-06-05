/**
 * useAvailableTimes — data hook for available-time windows.
 *
 * Op mapping:
 *  - WEEKLY patterns (recurring): use `availableTimesBulkCreateCreate`
 *    (POST /available-times/bulk-create/) with `rrule_string` set to a
 *    WEEKLY RRULE (e.g. "FREQ=WEEKLY;BYDAY=MO,WE"). The backend stores these
 *    as recurring AvailableTime objects.
 *
 *  - AD-HOC dates (non-recurring, specific date): also use
 *    `availableTimesBulkCreateCreate` but WITHOUT `rrule_string` / with
 *    `rrule_string` unset. Each entry is a concrete start_time/end_time pair
 *    on a specific date in the given timezone.
 *
 * Both operations share the same bulk-create endpoint:
 *   POST /available-times/bulk-create/
 *   Body: { available_times: AvailableTimeWritable[] }
 *
 * The `availableTimesBulkModifyCreate` (POST /available-times/{id}/bulk-modify/)
 * is for modifying/cancelling specific occurrences of an EXISTING recurring
 * series. It is NOT used here because the editor replaces the full set; future
 * edit-occurrence flows (Phase 26+) could use it.
 *
 * Cache invalidation:
 *   Both mutations invalidate all `availableTimesList` queries after success so
 *   the editor's list view re-fetches and reflects the saved state.
 */

import {
  availableTimesListOptions,
  availableTimesListQueryKey,
  availableTimesBulkCreateCreateMutation,
} from '@/client/@tanstack/react-query.gen';
import type {
  AvailableTimeWritable,
  BulkAvailableTimeWritable,
} from '@/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Query key — exported so other mutations can invalidate it.
// ---------------------------------------------------------------------------

export const AVAILABLE_TIMES_QUERY_KEY = availableTimesListQueryKey();

// ---------------------------------------------------------------------------
// useAvailableTimes
// ---------------------------------------------------------------------------

export function useAvailableTimes() {
  const queryClient = useQueryClient();

  // ---- Read ----------------------------------------------------------------
  const availableTimesQuery = useQuery(availableTimesListOptions());

  const availableTimes = availableTimesQuery.data?.results ?? [];

  // ---- Bulk-create mutation ------------------------------------------------
  // Used for BOTH weekly recurring patterns and ad-hoc specific-date windows.
  // The distinction is driven by the caller: weekly entries include `rrule_string`
  // (FREQ=WEEKLY;BYDAY=...) while ad-hoc entries omit it.
  const bulkCreateMutation = useMutation({
    ...availableTimesBulkCreateCreateMutation(),
    onSuccess: () => {
      // Invalidate all available-times list queries so the editor re-fetches.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'availableTimesList',
      });
    },
  });

  /**
   * Replace/add available times in bulk.
   *
   * Pass a mixed array of `AvailableTimeWritable` entries. Weekly entries should
   * include `rrule_string` (e.g. "FREQ=WEEKLY;BYDAY=MO,FR"); ad-hoc entries
   * should omit it or set it to undefined.
   *
   * Throws on API error so callers can catch and display a toast.
   */
  const bulkCreate = async (
    availableTimes: AvailableTimeWritable[]
  ): Promise<void> => {
    const body: BulkAvailableTimeWritable = { available_times: availableTimes };
    await bulkCreateMutation.mutateAsync({ body });
  };

  return {
    // Query state
    availableTimes,
    isLoading: availableTimesQuery.isLoading,
    isError: availableTimesQuery.isError,
    error: availableTimesQuery.error,
    availableTimesQuery,

    // Mutation
    bulkCreate,
    bulkCreateMutation,
    isPending: bulkCreateMutation.isPending,
  };
}
