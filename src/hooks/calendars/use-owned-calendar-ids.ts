/**
 * useOwnedCalendarIds — the calling member's own calendar ids, as a Set.
 *
 * Feeds `canEditCalendar` (@/components/calendar-groups/group-permissions):
 * "does this member own this calendar" is answered by listing the caller's
 * own calendars and comparing ids, because `Calendar` carries no owner field
 * (Guiding Decisions, calendar-group-scoped-availability plan).
 *
 * Named distinctly from `useMyCalendars` (use-my-calendars.ts) — that hook
 * already exists for the paginated "My calendars" table page and always
 * passes `owner: 'me'` over a `DataTableQuery`-shaped page. This hook has a
 * different job (a flat id set for a permission check, not a page of rows)
 * and a different shape (no pagination in/out), so it gets its own file
 * rather than overloading the existing one.
 *
 * Passes `owner: 'me'` explicitly rather than omitting the param. Per the
 * generated client's documented contract (see the `owner` query param doc
 * comment on `CalendarListData` in src/client/types.gen.ts): "Pass 'me' to
 * return only the authenticated user's own calendars... When omitted,
 * admins see all organization calendars while non-admins are restricted to
 * their own." Both forms should scope a non-admin caller to their own
 * calendars, but 'me' does so unconditionally (independent of the caller's
 * role), which is the stronger guarantee and the one this hook's caller
 * (the ownership predicate) actually needs — see group-permissions.ts for
 * why that distinction matters here.
 *
 * Fetches a single generous page rather than following pagination — an
 * individual's own calendar count is small in practice, matching the
 * tradeoff use-colleague-calendars.ts makes for a colleague's calendars.
 */

import { calendarListOptions } from '@/client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';

// Generous enough to cover any realistic individual's calendar count in one
// page — see the file-level comment on use-group-scoped-config-summary.ts
// for the same tradeoff applied to a slot's group-scoped rows.
export const OWNED_CALENDARS_PAGE_SIZE = 200;

export interface UseOwnedCalendarIdsOptions {
  /** Set to false to skip the fetch entirely (e.g. the viewer is an admin,
   * whose edit access does not depend on ownership). Defaults to true. */
  enabled?: boolean;
}

export interface OwnedCalendarIdsResult {
  ownedCalendarIds: ReadonlySet<number>;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useOwnedCalendarIds({
  enabled = true,
}: UseOwnedCalendarIdsOptions = {}): OwnedCalendarIdsResult {
  const query = useQuery({
    ...calendarListOptions({
      query: {
        owner: 'me',
        include_unlisted: true,
        limit: OWNED_CALENDARS_PAGE_SIZE,
      },
    }),
    enabled,
  });

  const ownedCalendarIds = new Set<number>(
    (query.data?.results ?? []).map((calendar) => calendar.id)
  );

  return {
    ownedCalendarIds,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
  };
}
