import {
  calendarListOptions,
  calendarListQueryKey,
} from '@/client/@tanstack/react-query.gen';
import type { Calendar } from '@/client';
import { useQuery } from '@tanstack/react-query';
import type { DataTableQuery } from '@/components/data-table/types';

// ---------------------------------------------------------------------------
// MY_CALENDARS_QUERY_KEY
//
// Base query key for `calendarList`. Exported so mutations
// (create, disable, phases 8/9) can invalidate all calendar-list queries.
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
//   queryClient.invalidateQueries({ queryKey: MY_CALENDARS_QUERY_KEY })
// ---------------------------------------------------------------------------

export const MY_CALENDARS_QUERY_KEY = calendarListQueryKey();

// ---------------------------------------------------------------------------
// useMyCalendars
//
// Wraps `calendarList` (GET /calendar/), which returns a paginated list of
// calendars visible to the calling member. The list is automatically scoped
// to the caller's calendars by the backend (no extra scoping param needed).
//
// Maps the DataTableQuery `page`/`pageSize` to the API's `limit`/`offset`
// style pagination.
//
// Note: the `/calendar/` endpoint supports `limit`, `offset`, `include_unlisted`,
// and `include_inactive`. It has no `search` or `ordering` params. Those fields
// in DataTableQuery are accepted for future compatibility but not forwarded.
// ---------------------------------------------------------------------------

export function useMyCalendars(query: DataTableQuery) {
  const limit = query.pageSize;
  const offset = (query.page - 1) * query.pageSize;

  const calendarsQuery = useQuery(
    calendarListOptions({ query: { limit, offset, include_unlisted: true } })
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
