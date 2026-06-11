/**
 * useAvailableTimes — data hook for available-time windows.
 *
 * Writes go through the atomic batch endpoint:
 *   POST /available-times/batch/
 *   Body: { operations: AvailableTimeOperation[], calendar?: number | null }
 *
 * Each operation is create (no id), update (id + changed fields), or delete
 * (id). Weekly patterns set `rrule_string` (e.g. "FREQ=WEEKLY;BYDAY=MO,WE");
 * ad-hoc windows omit it. The batch applies the whole set atomically — the only
 * way to replace an existing weekly schedule, since the editor renders a full
 * weekly matrix rather than tracking per-row edits.
 *
 * The endpoint returns the resulting full list, which `batchUpdate` hands back
 * to callers so they can rebuild their delete-baseline (avoiding re-creating the
 * same rows on a subsequent save).
 *
 * Cache invalidation:
 *   The batch mutation invalidates all `availableTimesList` queries after
 *   success so list views re-fetch and reflect the saved state.
 */

import {
  availableTimesListOptions,
  availableTimesListQueryKey,
  availableTimesBatchCreateMutation,
} from '@/client/@tanstack/react-query.gen';
import type { AvailableTime, AvailableTimeOperation } from '@/client';
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

  // ---- Batch mutation (atomic create/update/delete) ------------------------
  // POST /available-times/batch/ applies a list of create/update/delete
  // operations to a single calendar atomically — the only way to replace an
  // existing weekly schedule (bulk-create alone can't remove old rows).
  const batchMutation = useMutation({
    ...availableTimesBatchCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'availableTimesList',
      });
    },
  });

  /**
   * Apply an atomic batch of create/update/delete operations.
   *
   * @param operations - create (no id), update (id + changed fields), delete (id).
   * @param calendar - target calendar; omit/null → the user's default calendar.
   * Throws on API error so callers can catch and toast.
   */
  const batchUpdate = async (
    operations: AvailableTimeOperation[],
    calendar?: number | null
  ): Promise<AvailableTime[]> => {
    const res = await batchMutation.mutateAsync({
      body: { operations, calendar: calendar ?? null },
    });
    // The batch returns the resulting full list — callers use it as the new
    // delete-baseline so a subsequent save doesn't re-create the same rows.
    return res?.results ?? [];
  };

  return {
    // Query state
    availableTimes,
    isLoading: availableTimesQuery.isLoading,
    isError: availableTimesQuery.isError,
    error: availableTimesQuery.error,
    availableTimesQuery,

    // Mutations
    batchUpdate,
    batchMutation,
    isPending: batchMutation.isPending,
  };
}
