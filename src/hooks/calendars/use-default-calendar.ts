/**
 * useDefaultCalendar — resolves the authenticated user's default calendar.
 *
 * `GET /calendar/default/` returns 200 + Calendar when a default calendar
 * exists, or 404 when the user has not yet imported any calendars.
 *
 * A 404 is a normal onboarding state, NOT an error — it resolves to
 * `hasDefault: false, defaultCalendar: null` so callers can show an empty
 * state without triggering the query error boundary.
 *
 * Pattern mirrors `use-current-organization.ts`: manual queryFn with
 * explicit status inspection instead of the generated options factory
 * (which would throw on 404).
 */

import { calendarDefaultRetrieve } from '@/client';
import type { Calendar } from '@/client';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Query key — exported so mutations can invalidate it.
// ---------------------------------------------------------------------------

export const DEFAULT_CALENDAR_QUERY_KEY = ['calendars', 'default'] as const;

// ---------------------------------------------------------------------------
// useDefaultCalendar
// ---------------------------------------------------------------------------

export function useDefaultCalendar({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const query = useQuery<Calendar | null>({
    queryKey: DEFAULT_CALENDAR_QUERY_KEY,
    enabled,
    throwOnError: false,
    queryFn: async ({ signal }) => {
      const { data, response } = await calendarDefaultRetrieve({ signal });
      if (!response) {
        throw new Error('Failed to load default calendar (no response)');
      }
      if (response.status === 404) {
        // No default calendar yet — a normal onboarding state, not an error.
        return null;
      }
      if (!response.ok || !data) {
        throw new Error(`Failed to load default calendar (${response.status})`);
      }
      return data;
    },
  });

  const defaultCalendar = query.data ?? null;

  return {
    defaultCalendar,
    hasDefault: defaultCalendar !== null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    query,
  };
}
