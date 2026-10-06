/**
 * useAvailableTimes — data hook for one calendar's available-time windows.
 *
 * Reads are filtered to one calendar: `calendarId` when given, otherwise the
 * caller's default calendar. Unfiltered, the list returns every calendar's rows,
 * and the editor would then try to delete rows the batch (which only touches
 * one calendar) rejects.
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
import type {
  AvailableTime,
  AvailableTimeOperation,
  AvailableTimesListData,
} from '@/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDefaultCalendar } from '@/hooks/calendars/use-default-calendar';

// ---------------------------------------------------------------------------
// Query key — exported so other mutations can invalidate it.
// ---------------------------------------------------------------------------

export const AVAILABLE_TIMES_QUERY_KEY = availableTimesListQueryKey();

// ---------------------------------------------------------------------------
// useAvailableTimes
// ---------------------------------------------------------------------------

/**
 * @param calendarId - the calendar to read; omit/null → the caller's default
 *   calendar.
 */
export function useAvailableTimes(calendarId: number | null = null) {
  const queryClient = useQueryClient();

  // ---- Calendar ------------------------------------------------------------
  const usesDefault = calendarId === null;
  const defaultCalendarQuery = useDefaultCalendar({ enabled: usesDefault });
  const resolvedCalendarId = usesDefault
    ? (defaultCalendarQuery.defaultCalendar?.id ?? null)
    : calendarId;

  // ---- Read ----------------------------------------------------------------
  // `calendar` is a real filter (added at runtime by the backend filterset), so
  // drf-spectacular misses it and the generated query type lacks it.
  const availableTimesQuery = useQuery({
    ...availableTimesListOptions({
      query: {
        calendar: resolvedCalendarId ?? undefined,
      } as AvailableTimesListData['query'],
    }),
    // Never list unfiltered: wait until there is a calendar to filter by.
    enabled: resolvedCalendarId !== null,
  });

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
    // The backend returns a bare array, while the generated type claims a
    // paginated `{ results }` envelope (drf-spectacular wraps list actions).
    // Reading only `.results` yields an empty baseline and duplicates rows on
    // the next save, so accept both shapes.
    const data = res as unknown as
      | AvailableTime[]
      | { results?: AvailableTime[] }
      | undefined;
    if (Array.isArray(data)) return data;
    return data?.results ?? [];
  };

  return {
    // The calendar the rows were read from (null: no default calendar yet).
    calendarId: resolvedCalendarId,

    // Query state
    availableTimes,
    isLoading:
      (usesDefault && defaultCalendarQuery.isLoading) ||
      availableTimesQuery.isLoading,
    isError: availableTimesQuery.isError,
    error: availableTimesQuery.error,
    availableTimesQuery,

    // Mutations
    batchUpdate,
    batchMutation,
    isPending: batchMutation.isPending,
  };
}
