/**
 * useMyAvailability tests.
 *
 * Covers:
 * - busyWindows come solely from useUserAvailability's unavailable-windows
 *   (which already includes blocked-times) — no separate /blocked-times fetch
 * - busyWindows are sorted by start_time
 * - Disabled / empty when no default calendar (hasDefault:false)
 * - freeWindows pass through unchanged
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/hooks/calendars/use-default-calendar', () => ({
  useDefaultCalendar: vi.fn(),
  DEFAULT_CALENDAR_QUERY_KEY: ['calendars', 'default'],
}));

vi.mock('@/hooks/availability/use-user-availability', () => ({
  useUserAvailability: vi.fn(),
}));

import { useDefaultCalendar } from '@/hooks/calendars/use-default-calendar';
import { useUserAvailability } from '@/hooks/availability/use-user-availability';
import { useMyAvailability } from './use-my-availability';
import type {
  Calendar,
  AvailableTimeWindow,
  UnavailableTimeWindow,
} from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_CALENDAR: Calendar = {
  id: 10,
  name: 'Work Calendar',
  email: 'user@example.com',
  external_id: 'ext-10',
  provider: 'google',
  calendar_type: 'personal',
  capacity: null,
  manage_available_windows: false,
  visibility: 'active',
};

const FIXTURE_FREE: AvailableTimeWindow = {
  id: 1,
  start_time: '2025-06-01T09:00:00',
  end_time: '2025-06-01T12:00:00',
  can_book_partially: true,
};

const FIXTURE_EVENT_BUSY: UnavailableTimeWindow = {
  id: 2,
  reason: 'event',
  start_time: '2025-06-01T13:00:00',
  end_time: '2025-06-01T14:00:00',
  reason_description: 'Busy (calendar event)',
};

const FIXTURE_BLOCK_BUSY: UnavailableTimeWindow = {
  id: 3,
  reason: 'blocked_time',
  start_time: '2025-06-01T10:00:00',
  end_time: '2025-06-01T11:00:00',
  reason_description: 'Lunch break',
};

const RANGE = {
  startDatetime: '2025-06-01T00:00:00',
  endDatetime: '2025-06-07T23:59:59',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type UseDefaultCalendarReturn = ReturnType<typeof useDefaultCalendar>;
type UseUserAvailabilityReturn = ReturnType<typeof useUserAvailability>;

function makeDefaultCalendarResult(
  overrides: Partial<UseDefaultCalendarReturn> = {}
): UseDefaultCalendarReturn {
  return {
    defaultCalendar: FIXTURE_CALENDAR,
    hasDefault: true,
    isLoading: false,
    isError: false,
    error: null,
    query: {} as unknown as UseDefaultCalendarReturn['query'],
    ...overrides,
  };
}

function makeAvailabilityResult(
  overrides: Partial<UseUserAvailabilityReturn> = {}
): UseUserAvailabilityReturn {
  return {
    freeWindows: [],
    busyWindows: [],
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

function makeQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }
  return { Wrapper, queryClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useMyAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDefaultCalendar).mockReturnValue(makeDefaultCalendarResult());
    vi.mocked(useUserAvailability).mockReturnValue(makeAvailabilityResult());
  });

  // -------------------------------------------------------------------------
  // busyWindows come from unavailable-windows only (no double-counting)
  // -------------------------------------------------------------------------

  it('maps unavailable-windows (events + blocks) into busyWindows, sorted by start', async () => {
    vi.mocked(useUserAvailability).mockReturnValue(
      makeAvailabilityResult({
        busyWindows: [FIXTURE_EVENT_BUSY, FIXTURE_BLOCK_BUSY],
      })
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useMyAvailability(RANGE), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Both come through the single unavailable-windows source — no duplicates.
    expect(result.current.busyWindows).toHaveLength(2);
    // Sorted by start_time: the 10:00 block precedes the 13:00 event.
    expect(result.current.busyWindows[0].id).toBe(3);
    expect(result.current.busyWindows[0].reason_description).toBe(
      'Lunch break'
    );
    expect(result.current.busyWindows[1].id).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Disabled when no default calendar
  // -------------------------------------------------------------------------

  it('returns empty windows and hasDefault:false when there is no default calendar', async () => {
    vi.mocked(useDefaultCalendar).mockReturnValue(
      makeDefaultCalendarResult({ defaultCalendar: null, hasDefault: false })
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useMyAvailability(RANGE), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasDefault).toBe(false);
    expect(result.current.busyWindows).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Free windows pass through unchanged
  // -------------------------------------------------------------------------

  it('passes freeWindows through from useUserAvailability unchanged', async () => {
    vi.mocked(useUserAvailability).mockReturnValue(
      makeAvailabilityResult({ freeWindows: [FIXTURE_FREE] })
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useMyAvailability(RANGE), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.freeWindows).toHaveLength(1);
    expect(result.current.freeWindows[0].id).toBe(1);
  });
});
