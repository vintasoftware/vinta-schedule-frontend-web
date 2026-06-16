import { calendarListOptions } from '@/client/@tanstack/react-query.gen';
import type { Calendar } from '@/client';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useResourceCalendars
//
// Lists the organization's bookable resource calendars (rooms, equipment,
// etc.) via `calendarList` (GET /calendar/) scoped server-side to
// `calendar_type=resource`. Unlike useMyCalendars (which returns the caller's
// own calendars), this returns the shared resource calendars every member can
// book — so any user can allocate a resource when creating or editing an event.
//
// Returns only active resources (visibility === 'active'); unlisted/inactive
// resources are not bookable.
// ---------------------------------------------------------------------------

const RESOURCE_PAGE_SIZE = 100;

export function useResourceCalendars(options: { enabled?: boolean } = {}) {
  const calendarsQuery = useQuery({
    ...calendarListOptions({
      query: { calendar_type: 'resource', limit: RESOURCE_PAGE_SIZE },
    }),
    enabled: options.enabled ?? true,
  });

  const raw = calendarsQuery.data?.results ?? [];
  const calendars: Calendar[] = raw.filter((c) => c.visibility === 'active');

  return {
    calendars,
    totalCount: calendarsQuery.data?.count ?? 0,
    isLoading: calendarsQuery.isLoading,
    isError: calendarsQuery.isError,
    error: calendarsQuery.error,
    calendarsQuery,
  };
}
