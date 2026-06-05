/**
 * useCalendarGroups — list the Calendar Groups bookable by the calling member.
 *
 * Wraps `calendarGroupsList` (GET /calendar-groups/). The backend scopes the
 * list to the caller's organization. Each group embeds its `slots[]` (the
 * nested slot/required-count/candidate-pool model), so a single list call is
 * enough to drive the group picker and the per-slot booking UI.
 *
 * Exports CALENDAR_GROUPS_QUERY_KEY so any future group mutation (Phase 29
 * create-group) can invalidate the list.
 */

import {
  calendarGroupsListOptions,
  calendarGroupsListQueryKey,
} from '@/client/@tanstack/react-query.gen';
import type { CalendarGroup } from '@/client';
import { useQuery } from '@tanstack/react-query';

export const CALENDAR_GROUPS_QUERY_KEY = calendarGroupsListQueryKey();

export function useCalendarGroups() {
  const groupsQuery = useQuery(calendarGroupsListOptions());

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
