/**
 * useCalendarBookingPolicy — resolve the booking policy that directly targets a
 * single calendar, for the per-calendar self-service "Booking rules" dialog.
 *
 * The /booking-policies/ list endpoint has no calendar filter (only
 * limit/offset), so this fetches a generous page and finds the row whose
 * `calendar` matches. A member has at most a handful of policies, so one page is
 * enough in practice; if that ceiling is ever hit the backend needs a filter.
 *
 * Reads are open to any authenticated member (the backend scopes the list to
 * the org), so this works for the member self-service path as well as admins.
 *
 * Returns only the *calendar-level* policy — it does not resolve the full
 * precedence chain (calendar → membership → org default). It answers "does this
 * calendar have its own policy, and what is it?" which is exactly what the
 * create-vs-edit decision in the dialog needs.
 */

import * as React from 'react';
import { useBookingPolicies, type BookingPolicy } from './use-booking-policies';
import type { DataTableQuery } from '@/components/data-table/types';

const LOOKUP_QUERY: DataTableQuery = {
  page: 1,
  pageSize: 100,
  ordering: null,
  search: null,
};

export function useCalendarBookingPolicy(calendarId: number | null) {
  const { policies, isLoading, isError, error } = useBookingPolicies({
    query: LOOKUP_QUERY,
  });

  const policy: BookingPolicy | null = React.useMemo(() => {
    if (calendarId == null) return null;
    return policies.find((p) => p.calendar === calendarId) ?? null;
  }, [policies, calendarId]);

  return { policy, isLoading, isError, error };
}
