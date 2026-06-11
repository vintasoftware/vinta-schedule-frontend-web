/**
 * useCalendarGroups — list Calendar Groups with pagination and search.
 *
 * Wraps `calendarGroupsList` (GET /calendar-groups/). The backend scopes the
 * list to the caller's organization and supports pagination (limit/offset) and
 * search (name filter). Each group embeds its `slots[]` (the nested
 * slot/required-count/candidate-pool model).
 *
 * When called with a DataTableQuery (Phase 28 — admin list), maps page/pageSize
 * to limit/offset and search to the name filter. When called with no args
 * (Phase 18 — member booking picker), fetches all groups without pagination.
 *
 * Exports CALENDAR_GROUPS_QUERY_KEY so mutations (Phase 29 create-group) can
 * invalidate the list.
 */

import {
  calendarGroupsListOptions,
  calendarGroupsListQueryKey,
} from '@/client/@tanstack/react-query.gen';
import type { CalendarGroup } from '@/client';
import type { DataTableQuery } from '@/components/data-table/types';
import { useQuery } from '@tanstack/react-query';

export type { CalendarGroup };

export const CALENDAR_GROUPS_QUERY_KEY = calendarGroupsListQueryKey();

interface UseCalendarGroupsOptions {
  query?: DataTableQuery;
}

export function useCalendarGroups(options?: UseCalendarGroupsOptions) {
  const query = options?.query;

  // Map DataTableQuery pagination to API limit/offset; search to name filter.
  const limit = query ? query.pageSize : undefined;
  const offset = query ? (query.page - 1) * query.pageSize : undefined;
  const name = query?.search || undefined;

  const groupsQuery = useQuery(
    calendarGroupsListOptions({ query: { limit, offset, name } })
  );

  const groups: CalendarGroup[] = groupsQuery.data?.results ?? [];

  return {
    groups,
    totalCount: groupsQuery.data?.count ?? 0,
    isLoading: groupsQuery.isLoading,
    isError: groupsQuery.isError,
    error: groupsQuery.error,
    groupsQuery,
  };
}
