/**
 * useCalendarEvents tests.
 *
 * Covers:
 * - DateRange is mapped to the correct time-range query args via toApiRange
 *   (start_time_range_after / start_time_range_before)
 * - Optional calendarId is forwarded as the `calendar` query param
 * - Returned events are mapped to CalendarEventVM[] via toCalendarEventVMs
 * - isLoading / isError states are propagated correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// Mock the generated SDK so the TanStack query factory calls our stub.
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarEventsList: vi.fn(),
  };
});

import { calendarEventsList } from '@/client/sdk.gen';
import { useCalendarEvents } from './use-calendar-events';
import type { DateRange } from '@/lib/datetime/index';
import type { CalendarEvent, PaginatedCalendarEventList } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STUB_PARENT_EVENT = {
  id: 0,
  title: '',
  external_id: '',
  start_time: '2024-01-01T00:00:00Z',
  end_time: '2024-01-01T00:00:00Z',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
} as const;

const FIXTURE_EVENT_NY: CalendarEvent = {
  id: 1,
  title: 'New York Meeting',
  start_time: '2024-06-15T14:00:00-04:00',
  end_time: '2024-06-15T15:00:00-04:00',
  timezone: 'America/New_York',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  external_id: 'ext-1',
  external_attendances: [],
  attendances: [],
  resource_allocations: [],
  parent_recurring_object: STUB_PARENT_EVENT,
  is_recurring: false,
  is_recurring_instance: false,
};

const FIXTURE_EVENT_SYD: CalendarEvent = {
  id: 2,
  title: 'Sydney Standup',
  start_time: '2024-06-16T09:00:00+10:00',
  end_time: '2024-06-16T09:30:00+10:00',
  timezone: 'Australia/Sydney',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  external_id: 'ext-2',
  external_attendances: [],
  attendances: [],
  resource_allocations: [],
  parent_recurring_object: STUB_PARENT_EVENT,
  is_recurring: false,
  is_recurring_instance: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePagedResponse(
  results: CalendarEvent[],
  count = results.length
): Awaited<ReturnType<typeof calendarEventsList>> {
  const body: PaginatedCalendarEventList = { count, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarEventsList>>;
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
  return Wrapper;
}

/**
 * A fixed date range for June 15–21, 2024 in America/New_York (UTC-4 EDT).
 * This range is used to verify that toApiRange produces the expected ISO
 * strings with offset baked in.
 */
const FIXED_RANGE: DateRange = {
  start: DateTime.fromISO('2024-06-15T00:00:00', { zone: 'America/New_York' }),
  end: DateTime.fromISO('2024-06-21T23:59:59.999', {
    zone: 'America/New_York',
  }),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCalendarEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('query arg mapping', () => {
    it('maps DateRange to start_time_range_after / start_time_range_before with UTC offset', async () => {
      vi.mocked(calendarEventsList).mockResolvedValue(
        makePagedResponse([FIXTURE_EVENT_NY])
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(
        () => useCalendarEvents({ range: FIXED_RANGE }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const calls = vi.mocked(calendarEventsList).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const queryArgs = calls[calls.length - 1][0]?.query as Record<
        string,
        unknown
      >;

      // start_time_range_after should be the range start ISO with EDT offset
      expect(queryArgs?.start_time_range_after).toBe(
        '2024-06-15T00:00:00.000-04:00'
      );
      // start_time_range_before should be the range end ISO with EDT offset
      expect(queryArgs?.start_time_range_before).toBe(
        '2024-06-21T23:59:59.999-04:00'
      );
    });

    it('does NOT include the calendar param when calendarId is undefined', async () => {
      vi.mocked(calendarEventsList).mockResolvedValue(
        makePagedResponse([FIXTURE_EVENT_NY])
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(
        () => useCalendarEvents({ range: FIXED_RANGE }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const calls = vi.mocked(calendarEventsList).mock.calls;
      const queryArgs = calls[calls.length - 1][0]?.query as Record<
        string,
        unknown
      >;

      expect(queryArgs?.calendar).toBeUndefined();
    });

    it('forwards calendarId as the calendar query param when provided', async () => {
      vi.mocked(calendarEventsList).mockResolvedValue(
        makePagedResponse([FIXTURE_EVENT_NY])
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(
        () => useCalendarEvents({ range: FIXED_RANGE, calendarId: 42 }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const calls = vi.mocked(calendarEventsList).mock.calls;
      const queryArgs = calls[calls.length - 1][0]?.query as Record<
        string,
        unknown
      >;

      expect(queryArgs?.calendar).toBe(42);
    });
  });

  describe('VM mapping', () => {
    it('returns events mapped to CalendarEventVM[]', async () => {
      vi.mocked(calendarEventsList).mockResolvedValue(
        makePagedResponse([FIXTURE_EVENT_NY, FIXTURE_EVENT_SYD])
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(
        () => useCalendarEvents({ range: FIXED_RANGE }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.events).toHaveLength(2);

      const [nyVm, sydVm] = result.current.events;

      // ID is stringified
      expect(nyVm.id).toBe('1');
      expect(sydVm.id).toBe('2');

      // Titles preserved
      expect(nyVm.title).toBe('New York Meeting');
      expect(sydVm.title).toBe('Sydney Standup');

      // Timezones locked to stored zones
      expect(nyVm.timezone).toBe('America/New_York');
      expect(sydVm.timezone).toBe('Australia/Sydney');

      // Timezone labels differ (different zones)
      expect(nyVm.timezoneLabel).not.toBe(sydVm.timezoneLabel);

      // NY is UTC-4 (EDT in June)
      expect(nyVm.timezoneLabel).toContain('UTC-4');
      // Sydney AEST = UTC+10
      expect(sydVm.timezoneLabel).toContain('UTC+10');
    });

    it('returns an empty array when the API returns no results', async () => {
      vi.mocked(calendarEventsList).mockResolvedValue(makePagedResponse([]));

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(
        () => useCalendarEvents({ range: FIXED_RANGE }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.events).toHaveLength(0);
    });
  });

  describe('loading state', () => {
    it('returns isLoading=true while the query is in flight', async () => {
      // Never resolve
      vi.mocked(calendarEventsList).mockReturnValue(
        new Promise(() => {}) as never
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(
        () => useCalendarEvents({ range: FIXED_RANGE }),
        { wrapper }
      );

      // On first render the query has not resolved
      expect(result.current.isLoading).toBe(true);
      expect(result.current.events).toHaveLength(0);
    });
  });

  describe('error state', () => {
    it('returns isError=true when the API call rejects', async () => {
      vi.mocked(calendarEventsList).mockRejectedValue(
        new Error('Network failure')
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(
        () => useCalendarEvents({ range: FIXED_RANGE }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.events).toHaveLength(0);
    });
  });
});
