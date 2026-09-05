/**
 * Calendar pool data hooks.
 *
 * A CalendarPool is a named, reusable roster of calendars ("Nurses", "Consult
 * Rooms") that can be attached to the slots of any number of calendar groups,
 * so one roster edit propagates everywhere it is used. Wraps the generated
 * TanStack Query operations for /calendar-pools/:
 *   - useCalendarPools — paginated list (name search), for the admin table.
 *   - useAllCalendarPools — one large page, for the group form's pool picker.
 *   - useCreateCalendarPool / useUpdateCalendarPool — writes.
 *   - useDeleteCalendarPool — delete, refused with 409 while attached.
 *
 * Writes replace the roster wholesale: `calendar_ids` is the full membership
 * list, not a delta.
 *
 * Visibility is the backend's, not ours: an org admin gets full CRUD, while a
 * non-admin member reads only pools containing a calendar they own and cannot
 * write at all. So a member's list is already narrowed server-side and needs no
 * client-side filter.
 */

import {
  calendarPoolsListOptions,
  calendarPoolsListQueryKey,
  calendarPoolsCreateMutation,
  calendarPoolsPartialUpdateMutation,
  calendarPoolsDestroyMutation,
} from '@/client/@tanstack/react-query.gen';
import type {
  CalendarPool,
  CalendarPoolWritable,
  PatchedCalendarPoolWritable,
} from '@/client';
import type { DataTableQuery } from '@/components/data-table/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type { CalendarPool, CalendarPoolWritable, PatchedCalendarPoolWritable };

export const CALENDAR_POOLS_QUERY_KEY = calendarPoolsListQueryKey();

/**
 * One page big enough to hold every pool an organization realistically has, so
 * the group form's pool picker can offer all of them without paging. Mirrors
 * the 200-calendar page the group form already fetches for its calendar picker.
 */
export const ALL_POOLS_PAGE_SIZE = 200;

// Invalidate every calendar-pools list query (prefix + params variants). The
// no-args key returned by calendarPoolsListQueryKey() may not be a true prefix
// of the per-params keys, so match on the generated op `_id` instead.
function invalidateCalendarPools(
  queryClient: ReturnType<typeof useQueryClient>
) {
  return queryClient.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey) &&
      (q.queryKey[0] as { _id?: string })?._id === 'calendarPoolsList',
  });
}

// A pool's roster is projected into the slots it is attached to, so a roster
// edit changes what those groups offer. Bust the group queries too, or a group
// page open in another tab keeps showing the pre-edit roster.
function invalidateCalendarGroups(
  queryClient: ReturnType<typeof useQueryClient>
) {
  return queryClient.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey) &&
      ((q.queryKey[0] as { _id?: string })?._id === 'calendarGroupsList' ||
        q.queryKey[0] === 'calendar-groups'),
  });
}

interface UseCalendarPoolsOptions {
  query?: DataTableQuery;
  enabled?: boolean;
}

/**
 * useCalendarPools — the paginated pool list.
 *
 * With a DataTableQuery, maps page/pageSize to limit/offset and search to the
 * endpoint's partial `name` filter. With no args, fetches the default page.
 */
export function useCalendarPools(options?: UseCalendarPoolsOptions) {
  const query = options?.query;

  const limit = query ? query.pageSize : undefined;
  const offset = query ? (query.page - 1) * query.pageSize : undefined;
  const name = query?.search || undefined;

  const poolsQuery = useQuery({
    ...calendarPoolsListOptions({ query: { limit, offset, name } }),
    enabled: options?.enabled ?? true,
  });

  const pools: CalendarPool[] = poolsQuery.data?.results ?? [];

  return {
    pools,
    totalCount: poolsQuery.data?.count ?? 0,
    isLoading: poolsQuery.isLoading,
    isError: poolsQuery.isError,
    error: poolsQuery.error,
    poolsQuery,
  };
}

/**
 * useAllCalendarPools — every pool in one page, for pickers.
 *
 * `isTruncated` says the organization has more pools than one page holds, so a
 * picker can tell the user its options are incomplete rather than silently
 * offering a subset.
 */
export function useAllCalendarPools({ enabled = true } = {}) {
  const poolsQuery = useQuery({
    ...calendarPoolsListOptions({ query: { limit: ALL_POOLS_PAGE_SIZE } }),
    enabled,
  });

  const pools: CalendarPool[] = poolsQuery.data?.results ?? [];
  const totalCount = poolsQuery.data?.count ?? 0;

  return {
    pools,
    totalCount,
    isTruncated: totalCount > pools.length,
    isLoading: poolsQuery.isLoading,
    isError: poolsQuery.isError,
    error: poolsQuery.error,
    poolsQuery,
  };
}

/** useCreateCalendarPool — create a pool with its full roster. */
export function useCreateCalendarPool() {
  const queryClient = useQueryClient();

  const createPoolMutation = useMutation({
    ...calendarPoolsCreateMutation(),
    onSuccess: () => invalidateCalendarPools(queryClient),
  });

  const createCalendarPool = async (
    body: CalendarPoolWritable
  ): Promise<CalendarPool> => createPoolMutation.mutateAsync({ body });

  return { createCalendarPool, createPoolMutation };
}

/**
 * useUpdateCalendarPool — partially update a pool.
 *
 * Sending `calendar_ids` replaces the roster wholesale; omitting it leaves the
 * roster alone.
 */
export function useUpdateCalendarPool() {
  const queryClient = useQueryClient();

  const updatePoolMutation = useMutation({
    ...calendarPoolsPartialUpdateMutation(),
    onSuccess: () => {
      void invalidateCalendarGroups(queryClient);
      return invalidateCalendarPools(queryClient);
    },
  });

  const updateCalendarPool = async (
    id: number,
    body: PatchedCalendarPoolWritable
  ): Promise<CalendarPool> =>
    updatePoolMutation.mutateAsync({ path: { id: String(id) }, body });

  return { updateCalendarPool, updatePoolMutation };
}

/**
 * useDeleteCalendarPool — delete a pool.
 *
 * Refused with a 409 while the pool is attached to any group slot; the
 * rejection names the referencing groups. Read it with `readPoolInUseError`
 * rather than the generic message helper, which would show only the `detail`
 * string and drop the group names.
 */
export function useDeleteCalendarPool() {
  const queryClient = useQueryClient();

  const deletePoolMutation = useMutation({
    ...calendarPoolsDestroyMutation(),
    onSuccess: () => invalidateCalendarPools(queryClient),
  });

  const deleteCalendarPool = async (id: number): Promise<void> => {
    await deletePoolMutation.mutateAsync({ path: { id: String(id) } });
  };

  return { deleteCalendarPool, deletePoolMutation };
}

/** The 409 body returned when a pool is still attached to a group slot. */
export interface PoolInUseErrorBody {
  detail: string;
  /** Names of the calendar groups whose slots still reference the pool. */
  groups: string[];
}

/**
 * Reads the delete-refused rejection, or null for anything else.
 *
 * The generated client throws the parsed response body with no status attached
 * (see `api-errors.ts`), so this discriminates on shape: a `detail` string plus
 * a `groups` array of names.
 */
export function readPoolInUseError(error: unknown): PoolInUseErrorBody | null {
  if (error === null || typeof error !== 'object') {
    return null;
  }
  const body = error as Record<string, unknown>;
  if (typeof body.detail !== 'string' || !Array.isArray(body.groups)) {
    return null;
  }
  const groups = body.groups.filter((g): g is string => typeof g === 'string');
  if (groups.length !== body.groups.length) {
    return null;
  }
  return { detail: body.detail, groups };
}
