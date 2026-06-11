import {
  calendarListOptions,
  calendarListQueryKey,
} from '@/client/@tanstack/react-query.gen';
import type { Calendar } from '@/client';
import { useQuery } from '@tanstack/react-query';
import type { DataTableQuery } from '@/components/data-table/types';

// ---------------------------------------------------------------------------
// ALL_CALENDARS_QUERY_KEY
//
// Base query key for `calendarList` (admin org-wide scope). Exported so mutations
// (create, update, phase 30-32) can invalidate all-calendars queries.
//
// CAVEAT: the no-args key returned by `calendarListQueryKey()` may
// not be a true prefix of the per-page keys if the generated factory encodes
// the query params inside the key array. Prefer the predicate form for robust
// invalidation:
//
//   queryClient.invalidateQueries({
//     predicate: (q) =>
//       Array.isArray(q.queryKey) &&
//       (q.queryKey[0] as { _id?: string })?._id === 'calendarList',
//   });
//
// The prefix form still works for the simplest cases where the factory emits a
// flat key beginning with the op identifier:
//
//   queryClient.invalidateQueries({ queryKey: ALL_CALENDARS_QUERY_KEY })
// ---------------------------------------------------------------------------

export const ALL_CALENDARS_QUERY_KEY = calendarListQueryKey();

// ---------------------------------------------------------------------------
// useAllCalendars
//
// Wraps `calendarList` (GET /calendar/), returning all calendars visible to
// an admin user (org-wide scope). Whether the endpoint returns org-wide calendars
// for an admin is determined by backend RBAC — the frontend assumes the backend
// widens the result set appropriately.
//
// Maps the DataTableQuery `page`/`pageSize` to the API's `limit`/`offset`
// style pagination.
//
// Note: the `/calendar/` endpoint only supports `limit` and `offset`
// — it has no `search` or `ordering` query params. Those fields in DataTableQuery
// are accepted for future compatibility but are not forwarded to the API.
// There is also no type-filter API parameter; type filtering would need to
// be client-side only (not implemented — Phase 11 shows type as a badge column
// for clarity but does not filter).
// ---------------------------------------------------------------------------

export function useAllCalendars(query: DataTableQuery) {
  const limit = query.pageSize;
  const offset = (query.page - 1) * query.pageSize;

  const calendarsQuery = useQuery(
    calendarListOptions({ query: { limit, offset } })
  );

  const raw = calendarsQuery.data?.results ?? [];
  const totalCount = calendarsQuery.data?.count ?? 0;

  // Map API shape → Calendar view model (minimal transformation; Calendar
  // is mostly used as-is from the API response).
  const calendars: Calendar[] = raw;

  return {
    calendars,
    totalCount,
    isLoading: calendarsQuery.isLoading,
    isError: calendarsQuery.isError,
    error: calendarsQuery.error,
    calendarsQuery,
  };
}
