import {
  calendarListOptions,
  calendarListQueryKey,
} from '@/client/@tanstack/react-query.gen';
import type { Calendar, CalendarTypeEnum } from '@/client';
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
// Note: the `/calendar/` endpoint supports `limit`, `offset`, `include_unlisted`,
// `include_inactive`, and `calendar_type`. It has no `search` or `ordering`
// params. Those fields in DataTableQuery are accepted for future compatibility
// but not forwarded.
//
// Pass `options.calendarType` to scope the list to a single calendar type
// (e.g. 'personal' for the People-calendars view, 'resource' for Resources).
// ---------------------------------------------------------------------------

export interface UseAllCalendarsOptions {
  /** When set, only calendars of this type are returned (server-side filter). */
  calendarType?: CalendarTypeEnum;
}

export function useAllCalendars(
  query: DataTableQuery,
  options: UseAllCalendarsOptions = {}
) {
  const limit = query.pageSize;
  const offset = (query.page - 1) * query.pageSize;

  const calendarsQuery = useQuery(
    calendarListOptions({
      query: {
        limit,
        offset,
        include_unlisted: true,
        ...(options.calendarType
          ? { calendar_type: options.calendarType }
          : {}),
      },
    })
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
