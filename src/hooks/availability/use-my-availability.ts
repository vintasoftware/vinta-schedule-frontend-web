/**
 * useMyAvailability — the caller's own free/busy over a date range.
 *
 * Combines two data sources:
 *   1. `useDefaultCalendar` → resolves the user's default calendar id.
 *   2. `useUserAvailability` → free/busy windows for that calendar from
 *      GET /calendar/{id}/available-windows/ and .../unavailable-windows/.
 *
 * The unavailable-windows endpoint ALREADY folds the user's blocked-times into
 * its busy windows, so we do NOT additionally fetch GET /blocked-times/ — doing
 * so double-counted every block (it appeared once as an unavailable window and
 * again as a blocked-time). Busy windows here are the single source of truth.
 *
 * Privacy: only available/unavailable windows and system-level reason labels are
 * surfaced — never private event titles.
 */

import type { UnavailableTimeWindow } from '@/client';
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

  // Event-based availability — disabled until we have a calendar id. The busy
  // windows already include the user's blocked-times.
  const {
    freeWindows,
    busyWindows: eventBusyRaw,
    isLoading: avLoading,
    isError: avError,
  } = useUserAvailability(enabled ? calId : '', range);

  const busyWindows: BusyEntry[] = eventBusyRaw
    .map((w: UnavailableTimeWindow) => ({
      id: w.id,
      start_time: w.start_time,
      end_time: w.end_time,
      reason_description: w.reason_description,
    }))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const isLoading = calLoading || avLoading;
  const isError = calError || avError;

  return {
    defaultCalendar,
    hasDefault,
    freeWindows,
    busyWindows,
    isLoading,
    isError,
  };
}
