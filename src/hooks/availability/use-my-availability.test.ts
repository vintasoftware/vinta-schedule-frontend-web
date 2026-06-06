/**
 * useMyAvailability tests.
 *
 * Covers:
 * - Merges event-busy windows + block-busy windows into busyWindows
 * - Filters out blocks scoped to a DIFFERENT calendar id
 * - Includes blocks with calendar:null (global blocks)
 * - Disabled when no default calendar (hasDefault:false)
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

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    blockedTimesList: vi.fn(),
  };
});

import { useDefaultCalendar } from '@/hooks/calendars/use-default-calendar';
import { useUserAvailability } from '@/hooks/availability/use-user-availability';
import { blockedTimesList } from '@/client/sdk.gen';
import { useMyAvailability } from './use-my-availability';
import type {
  Calendar,
  AvailableTimeWindow,
  UnavailableTimeWindow,
  PaginatedBlockedTimeList,
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
  is_active: true,
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

const RANGE = {
  startDatetime: '2025-06-01T00:00:00',
  endDatetime: '2025-06-07T23:59:59',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type UseDefaultCalendarReturn = ReturnType<typeof useDefaultCalendar>;
type UseUserAvailabilityReturn = ReturnType<typeof useUserAvailability>;
type BlockedTimesResult = Awaited<ReturnType<typeof blockedTimesList>>;

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

function makeBlocksResponse(
  results: PaginatedBlockedTimeList['results']
): BlockedTimesResult {
  const data: PaginatedBlockedTimeList = {
    count: results.length,
    next: null,
    previous: null,
    results,
  };
  return {
    data,
    response: new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as BlockedTimesResult;
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
    // Default: has a default calendar, empty availability
    vi.mocked(useDefaultCalendar).mockReturnValue(makeDefaultCalendarResult());
    vi.mocked(useUserAvailability).mockReturnValue(makeAvailabilityResult());
    vi.mocked(blockedTimesList).mockResolvedValue(makeBlocksResponse([]));
  });

  // -------------------------------------------------------------------------
  // Merge: event-busy + blocks
  // -------------------------------------------------------------------------

  it('merges event-busy windows and blocked-time windows into busyWindows', async () => {
    vi.mocked(useUserAvailability).mockReturnValue(
      makeAvailabilityResult({ busyWindows: [FIXTURE_EVENT_BUSY] })
    );
    vi.mocked(blockedTimesList).mockResolvedValue(
      makeBlocksResponse([
        {
          id: 99,
          start_time: '2025-06-02T10:00:00',
          end_time: '2025-06-02T11:00:00',
          timezone: 'UTC',
          reason: 'Lunch break',
          is_recurring_instance: false,
          is_recurring: false,
          parent_blocked_time: null,
          external_id: 'ext-99',
          created: '2025-01-01T00:00:00Z',
          modified: '2025-01-01T00:00:00Z',
          calendar: 10, // same as FIXTURE_CALENDAR.id
        },
      ])
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useMyAvailability(RANGE), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.busyWindows).toHaveLength(2);
    // One event-source entry
    const eventEntry = result.current.busyWindows.find(
      (b) => b.source === 'event'
    );
    expect(eventEntry).toBeDefined();
    expect(eventEntry?.id).toBe(2);
    // One block-source entry
    const blockEntry = result.current.busyWindows.find(
      (b) => b.source === 'block'
    );
    expect(blockEntry).toBeDefined();
    expect(blockEntry?.id).toBe(99);
    expect(blockEntry?.reason_description).toBe('Lunch break');
  });

  // -------------------------------------------------------------------------
  // Filter: blocks for a different calendar are excluded
  // -------------------------------------------------------------------------

  it('filters out blocked-times scoped to a different calendar id', async () => {
    vi.mocked(blockedTimesList).mockResolvedValue(
      makeBlocksResponse([
        {
          id: 200,
          start_time: '2025-06-03T10:00:00',
          end_time: '2025-06-03T11:00:00',
          timezone: 'UTC',
          is_recurring_instance: false,
          is_recurring: false,
          parent_blocked_time: null,
          external_id: 'ext-200',
          created: '2025-01-01T00:00:00Z',
          modified: '2025-01-01T00:00:00Z',
          calendar: 999, // different calendar — must be excluded
        },
      ])
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useMyAvailability(RANGE), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.busyWindows).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Filter: blocks with calendar:null (global) are included
  // -------------------------------------------------------------------------

  it('includes blocked-times with calendar:null (global blocks)', async () => {
    vi.mocked(blockedTimesList).mockResolvedValue(
      makeBlocksResponse([
        {
          id: 300,
          start_time: '2025-06-04T08:00:00',
          end_time: '2025-06-04T09:00:00',
          timezone: 'UTC',
          is_recurring_instance: false,
          is_recurring: false,
          parent_blocked_time: null,
          external_id: 'ext-300',
          created: '2025-01-01T00:00:00Z',
          modified: '2025-01-01T00:00:00Z',
          calendar: null, // global block — must be included
        },
      ])
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useMyAvailability(RANGE), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.busyWindows).toHaveLength(1);
    expect(result.current.busyWindows[0].source).toBe('block');
    expect(result.current.busyWindows[0].id).toBe(300);
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
    // blockedTimesList should not be called — query is disabled
    expect(blockedTimesList).not.toHaveBeenCalled();
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

  // -------------------------------------------------------------------------
  // Block reason fallback
  // -------------------------------------------------------------------------

  it('falls back to "Blocked time" when block has no reason', async () => {
    vi.mocked(blockedTimesList).mockResolvedValue(
      makeBlocksResponse([
        {
          id: 400,
          start_time: '2025-06-05T10:00:00',
          end_time: '2025-06-05T11:00:00',
          timezone: 'UTC',
          is_recurring_instance: false,
          is_recurring: false,
          parent_blocked_time: null,
          external_id: 'ext-400',
          created: '2025-01-01T00:00:00Z',
          modified: '2025-01-01T00:00:00Z',
          calendar: null,
          // no reason field
        },
      ])
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useMyAvailability(RANGE), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.busyWindows[0].reason_description).toBe(
      'Blocked time'
    );
  });
});
