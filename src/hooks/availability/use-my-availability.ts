/**
 * useMyAvailability — the caller's own free/busy with blocked-times merged.
 *
 * Combines three data sources:
 *   1. `useDefaultCalendar` → resolves the user's default calendar id.
 *   2. `useUserAvailability` → event-based free/busy windows from the calendar.
 *   3. `blockedTimesListOptions` → one-off/recurring blocked-time windows.
 *
 * Blocked times are CALLER-SCOPED — `GET /blocked-times/` returns only the
 * authenticated user's own blocks (no path param). This hook is therefore
 * safe only for the self view; the Colleague view must stay events-only.
 *
 * Block filter: a BlockedTime is included when `calendar === null` (global,
 * applies to all calendars) or `calendar === defaultCalendar.id` (scoped to
 * this specific calendar). Blocks for a different calendar id are excluded.
 *
 * Merge strategy: event-busy windows (tagged source:'event') and
 * block-busy entries (tagged source:'block') are concatenated and sorted by
 * start_time. Free windows pass through unchanged. We do NOT recompute free
 * windows minus blocks — surfacing blocks as additional busy entries is
 * sufficient for the UI.
 */

import { useQuery } from '@tanstack/react-query';
import { blockedTimesListOptions } from '@/client/@tanstack/react-query.gen';
import type { BlockedTime } from '@/client';
import { useDefaultCalendar } from '@/hooks/calendars/use-default-calendar';
import {
  useUserAvailability,
  type DateRange,
} from '@/hooks/availability/use-user-availability';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusyEntry {
  id: number;
  start_time: string;
  end_time: string;
  reason_description: string;
  /** 'event' = came from calendar unavailable-windows; 'block' = blocked-time */
  source: 'event' | 'block';
}

export interface MyAvailabilityResult {
  freeWindows: ReturnType<typeof useUserAvailability>['freeWindows'];
  busyWindows: BusyEntry[];
  isLoading: boolean;
  isError: boolean;
  hasDefault: boolean;
  defaultCalendar: ReturnType<typeof useDefaultCalendar>['defaultCalendar'];
}

// ---------------------------------------------------------------------------
// useMyAvailability
// ---------------------------------------------------------------------------

export function useMyAvailability(
  range: DateRange | null,
  { enabled = true }: { enabled?: boolean } = {}
): MyAvailabilityResult {
  const {
    defaultCalendar,
    hasDefault,
    isLoading: calLoading,
    isError: calError,
  } = useDefaultCalendar({ enabled });

  const calId = String(defaultCalendar?.id ?? '');

  // Event-based availability — disabled until we have a calendar id.
  const {
    freeWindows,
    busyWindows: eventBusyRaw,
    isLoading: avLoading,
    isError: avError,
  } = useUserAvailability(enabled ? calId : '', range);

  // Blocked times — only meaningful when we have both a range and a default calendar.
  const blocksEnabled =
    enabled &&
    hasDefault &&
    Boolean(range?.startDatetime) &&
    Boolean(range?.endDatetime);

  const blocksQuery = useQuery({
    ...blockedTimesListOptions({
      query: {
        start_time: range?.startDatetime ?? '',
        end_time: range?.endDatetime ?? '',
        limit: 100,
      },
    }),
    enabled: blocksEnabled,
  });

  // ---------------------------------------------------------------------------
  // Merge
  // ---------------------------------------------------------------------------

  // Tag event-busy windows with source:'event'.
  const eventBusy: BusyEntry[] = eventBusyRaw.map((w) => ({
    id: w.id,
    start_time: w.start_time,
    end_time: w.end_time,
    reason_description: w.reason_description,
    source: 'event' as const,
  }));

  // Filter and tag blocked-time windows.
  const calendarId = defaultCalendar?.id ?? null;
  const blockBusy: BusyEntry[] = (blocksQuery.data?.results ?? [])
    .filter(
      (b: BlockedTime) => b.calendar === null || b.calendar === calendarId
    )
    .map((b: BlockedTime) => ({
      id: b.id,
      start_time: b.start_time,
      end_time: b.end_time,
      reason_description: b.reason ?? 'Blocked time',
      source: 'block' as const,
    }));

  const busyWindows: BusyEntry[] = [...eventBusy, ...blockBusy].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );

  const isLoading = calLoading || avLoading || blocksQuery.isLoading;
  const isError = calError || avError || blocksQuery.isError;

  return {
    defaultCalendar,
    hasDefault,
    freeWindows,
    busyWindows,
    isLoading,
    isError,
  };
}
