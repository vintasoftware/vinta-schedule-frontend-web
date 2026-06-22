/**
 * useColleagueCalendars — resolve a colleague's calendars from their user id.
 *
 * Colleague → Calendar resolution:
 * --------------------------------------------------------------------------
 * GET /calendar/ accepts an `owner` query param. Passing a numeric user id
 * scopes the listing to that user's calendars (allowed for organization admins;
 * non-admins receive 403). This is the mapping used to turn a selected org
 * member (user id, from `useOrgMemberSearch`) into the calendar id that the
 * free/busy windows endpoints require.
 *
 * Only personal calendars are returned — those are the ones whose free/busy
 * windows represent the colleague's own availability. The list is the input to
 * a calendar picker in the colleague free/busy view; when a colleague has a
 * single personal calendar the view auto-selects it.
 * --------------------------------------------------------------------------
 */

import { calendarListOptions } from '@/client/@tanstack/react-query.gen';
import type { Calendar } from '@/client';
import { useQuery } from '@tanstack/react-query';

export interface ColleagueCalendarsResult {
  /** The colleague's personal calendars, usable as free/busy targets. */
  calendars: Calendar[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Returns the personal calendars owned by `userId`.
 *
 * @param userId - numeric user id of the colleague; pass null to disable.
 */
export function useColleagueCalendars(
  userId: number | null
): ColleagueCalendarsResult {
  const query = useQuery({
    ...calendarListOptions({
      query: {
        owner: userId ? String(userId) : '',
        calendar_type: 'personal',
        limit: 100,
      },
    }),
    enabled: Boolean(userId),
  });

  const calendars: Calendar[] = query.data?.results ?? [];

  return {
    calendars,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
  };
}
