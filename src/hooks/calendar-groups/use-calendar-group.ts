/**
 * useCalendarGroup — fetch a single calendar group by id.
 *
 * The API returns 404 identically whether the group doesn't exist, belongs to
 * another organization, is out of the caller's scope, or the caller simply
 * isn't authorized (spec UC-8 — the non-disclosure requirement). This hook
 * surfaces exactly one bit, `isNotFound`, and nothing else, so no caller can
 * build UI that leaks which of those cases occurred.
 *
 * Uses a manual queryFn with throwOnError:false to inspect the response
 * status directly, mirroring use-current-organization.ts / use-default-
 * calendar.ts. The generated `calendarGroupsRetrieveOptions` uses
 * throwOnError:true and throws the parsed JSON body on error — which has no
 * status field — so it can't be used to distinguish 404 from any other
 * failure.
 */

import { calendarGroupsRetrieve } from '@/client';
import type { CalendarGroup } from '@/client';
import { useQuery } from '@tanstack/react-query';

export const calendarGroupQueryKey = (id: string) =>
  ['calendar-groups', id] as const;

export type CalendarGroupResult =
  | { status: 'ok'; group: CalendarGroup }
  | { status: 'not_found'; group: null };

export function useCalendarGroup(
  id: string,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const query = useQuery<CalendarGroupResult>({
    queryKey: calendarGroupQueryKey(id),
    enabled,
    queryFn: async ({ signal }) => {
      const { data, response } = await calendarGroupsRetrieve({
        path: { id },
        signal,
        throwOnError: false,
      });
      if (!response) {
        throw new Error('Failed to load calendar group (no response)');
      }
      if (response.status === 404) {
        // Identical for missing / other-org / out-of-scope / unauthorized —
        // see the doc comment above. Not an error state.
        return { status: 'not_found', group: null };
      }
      if (!response.ok || !data) {
        throw new Error(`Failed to load calendar group (${response.status})`);
      }
      return { status: 'ok', group: data };
    },
  });

  const result = query.data;

  return {
    group: result?.status === 'ok' ? result.group : null,
    isNotFound: result?.status === 'not_found',
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    query,
  };
}
