/**
 * useAvailableTimes tests.
 *
 * Covers:
 * - List reads: useQuery wraps availableTimesList, filtered to the calendar
 * - Batch update: availableTimesBatchCreate is called with the operations and
 *   target calendar; the resulting list is returned to the caller
 * - Default calendar: with no calendarId, reads the default calendar; with no
 *   default, never lists unfiltered
 * - Error propagation: batch rejection surfaces to the caller
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    availableTimesList: vi.fn(),
    availableTimesBatchCreate: vi.fn(),
    calendarDefaultRetrieve: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import {
  availableTimesList,
  availableTimesBatchCreate,
  calendarDefaultRetrieve,
} from '@/client/sdk.gen';
import { useAvailableTimes } from './use-available-times';
import type {
  AvailableTime,
  AvailableTimeBatch,
  PaginatedAvailableTimeList,
} from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CALENDAR_ID = 23;

const FIXTURE_AVAILABLE_TIME: AvailableTime = {
  id: 1,
  start_time: '2024-01-01T09:00:00',
  end_time: '2024-01-01T17:00:00',
  timezone: 'America/New_York',
  is_recurring: true,
  is_recurring_instance: false,
  parent_available_time: null,
  recurrence_id: null,
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  calendar: CALENDAR_ID,
};

const FIXTURE_PAGINATED_LIST: PaginatedAvailableTimeList = {
  count: 1,
  next: null,
  previous: null,
  results: [FIXTURE_AVAILABLE_TIME],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeListResponse(
  data: PaginatedAvailableTimeList
): Awaited<ReturnType<typeof availableTimesList>> {
  return {
    data,
    response: new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof availableTimesList>>;
}

function makeBatchResponse(
  results: AvailableTime[] = []
): Awaited<ReturnType<typeof availableTimesBatchCreate>> {
  const data: PaginatedAvailableTimeList = {
    count: results.length,
    next: null,
    previous: null,
    results,
  };
  return {
    data,
    response: new Response(JSON.stringify(data), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof availableTimesBatchCreate>>;
}

function makeDefaultCalendarResponse(
  status: number,
  id?: number
): Awaited<ReturnType<typeof calendarDefaultRetrieve>> {
  const calendar = id === undefined ? undefined : { id };
  return {
    data: calendar,
    response: new Response(calendar ? JSON.stringify(calendar) : null, {
      status,
    }),
  } as unknown as Awaited<ReturnType<typeof calendarDefaultRetrieve>>;
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

describe('useAvailableTimes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // List reads
  // -------------------------------------------------------------------------

  describe('list reads', () => {
    it('returns availableTimes from the list query', async () => {
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse(FIXTURE_PAGINATED_LIST)
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(CALENDAR_ID), {
        wrapper: Wrapper,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.availableTimes).toHaveLength(1);
      expect(result.current.availableTimes[0].id).toBe(1);
    });

    it('reads only the given calendar', async () => {
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse(FIXTURE_PAGINATED_LIST)
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(CALENDAR_ID), {
        wrapper: Wrapper,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(availableTimesList).toHaveBeenCalledOnce();
      expect(vi.mocked(availableTimesList).mock.calls[0][0]?.query).toEqual({
        calendar: CALENDAR_ID,
      });
    });

    it('returns empty array when list is empty', async () => {
      const emptyList: PaginatedAvailableTimeList = {
        count: 0,
        next: null,
        previous: null,
        results: [],
      };
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse(emptyList)
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(CALENDAR_ID), {
        wrapper: Wrapper,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.availableTimes).toHaveLength(0);
    });

    it('exposes isError when query fails', async () => {
      vi.mocked(availableTimesList).mockRejectedValue(
        new Error('Network error')
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(CALENDAR_ID), {
        wrapper: Wrapper,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isError).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Batch update
  // -------------------------------------------------------------------------

  describe('batchUpdate', () => {
    it('calls availableTimesBatchCreate with the operations and calendar', async () => {
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse(FIXTURE_PAGINATED_LIST)
      );
      vi.mocked(availableTimesBatchCreate).mockResolvedValue(
        makeBatchResponse([FIXTURE_AVAILABLE_TIME])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(CALENDAR_ID), {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.batchUpdate(
          [
            { action: 'delete', id: 7 },
            {
              action: 'create',
              start_time: '2024-01-01T09:00:00',
              end_time: '2024-01-01T17:00:00',
              timezone: 'America/New_York',
              rrule_string: 'FREQ=WEEKLY;BYDAY=MO',
            },
          ],
          CALENDAR_ID
        );
      });

      expect(availableTimesBatchCreate).toHaveBeenCalledOnce();
      const callArg = vi.mocked(availableTimesBatchCreate).mock.calls[0][0];
      const body = callArg.body as AvailableTimeBatch;
      expect(body.calendar).toBe(CALENDAR_ID);
      expect(body.operations).toHaveLength(2);
      expect(body.operations[0]).toEqual({ action: 'delete', id: 7 });
      expect(body.operations[1].rrule_string).toBe('FREQ=WEEKLY;BYDAY=MO');
    });

    it('returns the resulting list so callers can rebuild their delete-baseline', async () => {
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse(FIXTURE_PAGINATED_LIST)
      );
      vi.mocked(availableTimesBatchCreate).mockResolvedValue(
        makeBatchResponse([FIXTURE_AVAILABLE_TIME])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(CALENDAR_ID), {
        wrapper: Wrapper,
      });

      let returned: AvailableTime[] = [];
      await act(async () => {
        returned = await result.current.batchUpdate([
          {
            action: 'create',
            start_time: '2024-01-01T09:00:00',
            end_time: '2024-01-01T17:00:00',
            timezone: 'UTC',
          },
        ]);
      });

      expect(returned).toHaveLength(1);
      expect(returned[0].id).toBe(1);
    });

    it('returns the resulting list when the backend sends a bare array', async () => {
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse(FIXTURE_PAGINATED_LIST)
      );
      // The real endpoint returns `AvailableTime[]`, not the paginated
      // envelope the generated type declares.
      vi.mocked(availableTimesBatchCreate).mockResolvedValue({
        data: [FIXTURE_AVAILABLE_TIME],
        response: new Response(JSON.stringify([FIXTURE_AVAILABLE_TIME]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      } as unknown as Awaited<ReturnType<typeof availableTimesBatchCreate>>);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(CALENDAR_ID), {
        wrapper: Wrapper,
      });

      let returned: AvailableTime[] = [];
      await act(async () => {
        returned = await result.current.batchUpdate([
          {
            action: 'create',
            start_time: '2024-01-01T09:00:00',
            end_time: '2024-01-01T17:00:00',
            timezone: 'UTC',
          },
        ]);
      });

      expect(returned).toEqual([FIXTURE_AVAILABLE_TIME]);
    });
  });

  // -------------------------------------------------------------------------
  // Default calendar (no calendarId)
  // -------------------------------------------------------------------------

  describe('default calendar', () => {
    it('reads the default calendar when no calendarId is given', async () => {
      vi.mocked(calendarDefaultRetrieve).mockResolvedValue(
        makeDefaultCalendarResponse(200, CALENDAR_ID)
      );
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse(FIXTURE_PAGINATED_LIST)
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(), {
        wrapper: Wrapper,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.calendarId).toBe(CALENDAR_ID);
      expect(vi.mocked(availableTimesList).mock.calls[0][0]?.query).toEqual({
        calendar: CALENDAR_ID,
      });
    });

    it('never lists unfiltered when there is no default calendar', async () => {
      vi.mocked(calendarDefaultRetrieve).mockResolvedValue(
        makeDefaultCalendarResponse(404)
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(null), {
        wrapper: Wrapper,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.calendarId).toBeNull();
      expect(availableTimesList).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('throws when batch rejects', async () => {
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse(FIXTURE_PAGINATED_LIST)
      );
      vi.mocked(availableTimesBatchCreate).mockRejectedValue(
        new Error('API error')
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(CALENDAR_ID), {
        wrapper: Wrapper,
      });

      await act(async () => {
        await expect(
          result.current.batchUpdate([{ action: 'delete', id: 1 }])
        ).rejects.toThrow('API error');
      });
    });
  });
});
