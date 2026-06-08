/**
 * useUserAvailability tests.
 *
 * Covers:
 * - Returns free windows from calendarAvailableWindowsList
 * - Returns busy windows from calendarUnavailableWindowsList
 * - No private event titles leak (API types do not include them; verified by shape)
 * - Disabled when calendarId is empty
 * - Disabled when range is null
 * - isError exposed when either query fails
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarAvailableWindowsList: vi.fn(),
    calendarUnavailableWindowsList: vi.fn(),
  };
});

import {
  calendarAvailableWindowsList,
  calendarUnavailableWindowsList,
} from '@/client/sdk.gen';
import { useUserAvailability, type DateRange } from './use-user-availability';
import type {
  AvailableTimeWindow,
  UnavailableTimeWindow,
  PaginatedAvailableTimeWindowList,
  PaginatedUnavailableTimeWindowList,
} from '@/client';

// ---------------------------------------------------------------------------
// Helpers for bare-array (non-paginated) server responses
// ---------------------------------------------------------------------------

function makeBareArrayFreeResponse(
  items: AvailableTimeWindow[]
): Awaited<ReturnType<typeof calendarAvailableWindowsList>> {
  return {
    data: items,
    response: new Response(JSON.stringify(items), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarAvailableWindowsList>>;
}

function makeBareArrayBusyResponse(
  items: UnavailableTimeWindow[]
): Awaited<ReturnType<typeof calendarUnavailableWindowsList>> {
  return {
    data: items,
    response: new Response(JSON.stringify(items), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarUnavailableWindowsList>>;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_FREE_WINDOW: AvailableTimeWindow = {
  id: 1,
  start_time: '2025-06-01T09:00:00',
  end_time: '2025-06-01T12:00:00',
  can_book_partially: true,
};

const FIXTURE_BUSY_WINDOW: UnavailableTimeWindow = {
  id: 2,
  reason: 'blocked',
  start_time: '2025-06-01T13:00:00',
  end_time: '2025-06-01T14:00:00',
  reason_description: 'Blocked time',
};

const FIXTURE_FREE_LIST: PaginatedAvailableTimeWindowList = {
  count: 1,
  next: null,
  previous: null,
  results: [FIXTURE_FREE_WINDOW],
};

const FIXTURE_BUSY_LIST: PaginatedUnavailableTimeWindowList = {
  count: 1,
  next: null,
  previous: null,
  results: [FIXTURE_BUSY_WINDOW],
};

const EMPTY_FREE_LIST: PaginatedAvailableTimeWindowList = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

const EMPTY_BUSY_LIST: PaginatedUnavailableTimeWindowList = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

const VALID_RANGE: DateRange = {
  startDatetime: '2025-06-01T00:00:00',
  endDatetime: '2025-06-07T23:59:59',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFreeResponse(
  data: PaginatedAvailableTimeWindowList
): Awaited<ReturnType<typeof calendarAvailableWindowsList>> {
  return {
    data,
    response: new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarAvailableWindowsList>>;
}

function makeBusyResponse(
  data: PaginatedUnavailableTimeWindowList
): Awaited<ReturnType<typeof calendarUnavailableWindowsList>> {
  return {
    data,
    response: new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarUnavailableWindowsList>>;
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

describe('useUserAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe('happy path', () => {
    it('returns free windows from calendarAvailableWindowsList', async () => {
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeFreeResponse(FIXTURE_FREE_LIST)
      );
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeBusyResponse(EMPTY_BUSY_LIST)
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useUserAvailability('42', VALID_RANGE),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.freeWindows).toHaveLength(1);
      expect(result.current.freeWindows[0].id).toBe(1);
      expect(result.current.freeWindows[0].start_time).toBe(
        '2025-06-01T09:00:00'
      );
    });

    it('returns busy windows from calendarUnavailableWindowsList', async () => {
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeFreeResponse(EMPTY_FREE_LIST)
      );
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeBusyResponse(FIXTURE_BUSY_LIST)
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useUserAvailability('42', VALID_RANGE),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.busyWindows).toHaveLength(1);
      expect(result.current.busyWindows[0].id).toBe(2);
      expect(result.current.busyWindows[0].start_time).toBe(
        '2025-06-01T13:00:00'
      );
    });

    it('calls calendarAvailableWindowsList with the correct calendarId + range', async () => {
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeFreeResponse(EMPTY_FREE_LIST)
      );
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeBusyResponse(EMPTY_BUSY_LIST)
      );

      const { Wrapper } = makeQueryWrapper();
      renderHook(() => useUserAvailability('99', VALID_RANGE), {
        wrapper: Wrapper,
      });

      await waitFor(() =>
        expect(calendarAvailableWindowsList).toHaveBeenCalled()
      );

      const call = vi.mocked(calendarAvailableWindowsList).mock.calls[0][0];
      expect(call.path.id).toBe('99');
      expect(call.query.start_datetime).toBe(VALID_RANGE.startDatetime);
      expect(call.query.end_datetime).toBe(VALID_RANGE.endDatetime);
    });

    it('calls calendarUnavailableWindowsList with the correct calendarId + range', async () => {
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeFreeResponse(EMPTY_FREE_LIST)
      );
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeBusyResponse(EMPTY_BUSY_LIST)
      );

      const { Wrapper } = makeQueryWrapper();
      renderHook(() => useUserAvailability('99', VALID_RANGE), {
        wrapper: Wrapper,
      });

      await waitFor(() =>
        expect(calendarUnavailableWindowsList).toHaveBeenCalled()
      );

      const call = vi.mocked(calendarUnavailableWindowsList).mock.calls[0][0];
      expect(call.path.id).toBe('99');
      expect(call.query.start_datetime).toBe(VALID_RANGE.startDatetime);
      expect(call.query.end_datetime).toBe(VALID_RANGE.endDatetime);
    });

    // -----------------------------------------------------------------------
    // Bare-array regression — the live API returns [] not { count, results }
    // -----------------------------------------------------------------------

    it('populates freeWindows when server returns a bare array (regression)', async () => {
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeBareArrayFreeResponse([FIXTURE_FREE_WINDOW])
      );
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeBareArrayBusyResponse([])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useUserAvailability('42', VALID_RANGE),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.freeWindows).toHaveLength(1);
      expect(result.current.freeWindows[0].id).toBe(1);
    });

    it('populates busyWindows when server returns a bare array (regression)', async () => {
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeBareArrayFreeResponse([])
      );
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeBareArrayBusyResponse([FIXTURE_BUSY_WINDOW])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useUserAvailability('42', VALID_RANGE),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.busyWindows).toHaveLength(1);
      expect(result.current.busyWindows[0].id).toBe(2);
    });

    it('free windows do not contain any title field (privacy)', async () => {
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeFreeResponse(FIXTURE_FREE_LIST)
      );
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeBusyResponse(EMPTY_BUSY_LIST)
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useUserAvailability('42', VALID_RANGE),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const window = result.current.freeWindows[0];
      // AvailableTimeWindow must not carry a title field
      expect('title' in window).toBe(false);
      expect(Object.keys(window)).toEqual(
        expect.arrayContaining(['id', 'start_time', 'end_time'])
      );
      expect(Object.keys(window)).not.toContain('title');
      expect(Object.keys(window)).not.toContain('description');
      expect(Object.keys(window)).not.toContain('summary');
    });

    it('busy windows do not contain any private title field (privacy)', async () => {
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeFreeResponse(EMPTY_FREE_LIST)
      );
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeBusyResponse(FIXTURE_BUSY_LIST)
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useUserAvailability('42', VALID_RANGE),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const window = result.current.busyWindows[0];
      // UnavailableTimeWindow must not carry a private title field
      expect(Object.keys(window)).not.toContain('title');
      expect(Object.keys(window)).not.toContain('description');
      expect(Object.keys(window)).not.toContain('summary');
      // reason_description is a non-private system label (not event title)
      expect('reason_description' in window).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Disabled when inputs are incomplete
  // -------------------------------------------------------------------------

  describe('disabled when inputs incomplete', () => {
    it('does not call the API when calendarId is empty', async () => {
      const { Wrapper } = makeQueryWrapper();
      renderHook(() => useUserAvailability('', VALID_RANGE), {
        wrapper: Wrapper,
      });

      // Give it a tick to potentially fire
      await new Promise((r) => setTimeout(r, 20));

      expect(calendarAvailableWindowsList).not.toHaveBeenCalled();
      expect(calendarUnavailableWindowsList).not.toHaveBeenCalled();
    });

    it('does not call the API when range is null', async () => {
      const { Wrapper } = makeQueryWrapper();
      renderHook(() => useUserAvailability('42', null), {
        wrapper: Wrapper,
      });

      await new Promise((r) => setTimeout(r, 20));

      expect(calendarAvailableWindowsList).not.toHaveBeenCalled();
      expect(calendarUnavailableWindowsList).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('exposes isError when calendarAvailableWindowsList fails', async () => {
      vi.mocked(calendarAvailableWindowsList).mockRejectedValue(
        new Error('Network error')
      );
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeBusyResponse(EMPTY_BUSY_LIST)
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useUserAvailability('42', VALID_RANGE),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isError).toBe(true);
      expect(result.current.freeWindows).toHaveLength(0);
    });

    it('exposes isError when calendarUnavailableWindowsList fails', async () => {
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeFreeResponse(EMPTY_FREE_LIST)
      );
      vi.mocked(calendarUnavailableWindowsList).mockRejectedValue(
        new Error('Network error')
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useUserAvailability('42', VALID_RANGE),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isError).toBe(true);
      expect(result.current.busyWindows).toHaveLength(0);
    });
  });
});
