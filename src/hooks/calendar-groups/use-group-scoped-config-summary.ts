/**
 * useGroupScopedConfigSummary — per-calendar counts of group-scoped
 * availability windows, blocked times, and quota rules for one slot.
 *
 * This is a read-only summary for the roster's configuration cell (Phase 1).
 * The per-concept hooks with create/update/delete and cache invalidation
 * (Phases 3a, 4, 5) own the same list operations plus their mutations; this
 * hook does not anticipate their shape and can be revisited once they land.
 *
 * The three list endpoints are paginated but take no `calendar_id` filter —
 * they return every row in the slot, across all calendars in its roster — so
 * counts are derived client-side by grouping on `calendar_id`. A generous
 * page size is requested in one page: the roster panel needs a count, not a
 * full listing, and slot rosters are small collections in practice. A slot
 * with more group-scoped rows than the page size undercounts rather than
 * fails; there is no pagination UI here to fix that, by design (Phase 1 is
 * read-only).
 */

import { useQueries } from '@tanstack/react-query';
import {
  calendarGroupsSlotsAvailabilityWindowsListOptions,
  calendarGroupsSlotsBlockedTimesListOptions,
  calendarGroupsSlotsQuotaRulesListOptions,
} from '@/client/@tanstack/react-query.gen';

// Large enough to cover any realistic slot roster's group-scoped rows in one
// page — see the file-level comment on why undercounting (not failing) is
// the fallback for an outsized slot.
const SUMMARY_PAGE_SIZE = 200;

export interface CalendarConfigSummary {
  windowCount: number;
  blockCount: number;
  quotaCount: number;
}

function countByCalendar(
  rows: ReadonlyArray<{ calendar_id: number }> | undefined
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of rows ?? []) {
    counts.set(row.calendar_id, (counts.get(row.calendar_id) ?? 0) + 1);
  }
  return counts;
}

export function useGroupScopedConfigSummary({
  groupId,
  slotId,
}: {
  groupId: number;
  slotId: number;
}) {
  const [windowsQuery, blocksQuery, quotaQuery] = useQueries({
    queries: [
      calendarGroupsSlotsAvailabilityWindowsListOptions({
        path: { group_id: groupId, slot_id: slotId },
        query: { limit: SUMMARY_PAGE_SIZE },
      }),
      calendarGroupsSlotsBlockedTimesListOptions({
        path: { group_id: groupId, slot_id: slotId },
        query: { limit: SUMMARY_PAGE_SIZE },
      }),
      calendarGroupsSlotsQuotaRulesListOptions({
        path: { group_id: groupId, slot_id: slotId },
        query: { limit: SUMMARY_PAGE_SIZE },
      }),
    ],
  });

  const windowCounts = countByCalendar(windowsQuery.data?.results);
  const blockCounts = countByCalendar(blocksQuery.data?.results);
  const quotaCounts = countByCalendar(quotaQuery.data?.results);

  const summaryFor = (calendarId: number): CalendarConfigSummary => ({
    windowCount: windowCounts.get(calendarId) ?? 0,
    blockCount: blockCounts.get(calendarId) ?? 0,
    quotaCount: quotaCounts.get(calendarId) ?? 0,
  });

  return {
    summaryFor,
    isLoading:
      windowsQuery.isLoading || blocksQuery.isLoading || quotaQuery.isLoading,
    isError: windowsQuery.isError || blocksQuery.isError || quotaQuery.isError,
  };
}
