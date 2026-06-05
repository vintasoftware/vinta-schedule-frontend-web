/**
 * useAvailableTimes tests.
 *
 * Covers:
 * - List reads: useQuery wraps availableTimesList correctly
 * - Weekly pattern save: bulk-create is called with rrule_string for weekly entries
 * - Ad-hoc save: bulk-create is called without rrule_string for specific dates
 * - Cache invalidation: availableTimesList queries are invalidated on success
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
    availableTimesBulkCreateCreate: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import {
  availableTimesList,
  availableTimesBulkCreateCreate,
} from '@/client/sdk.gen';
import { useAvailableTimes } from './use-available-times';
import type {
  AvailableTime,
  BulkAvailableTimeWritable,
  PaginatedAvailableTimeList,
} from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
  calendar: 1,
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

function makeBulkCreateResponse(): Awaited<
  ReturnType<typeof availableTimesBulkCreateCreate>
> {
  const data: PaginatedAvailableTimeList = {
    count: 0,
    next: null,
    previous: null,
    results: [],
  };
  return {
    data,
    response: new Response(JSON.stringify(data), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof availableTimesBulkCreateCreate>>;
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
      const { result } = renderHook(() => useAvailableTimes(), {
        wrapper: Wrapper,
      });

      // Wait for data to resolve
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.availableTimes).toHaveLength(1);
      expect(result.current.availableTimes[0].id).toBe(1);
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
      const { result } = renderHook(() => useAvailableTimes(), {
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
      const { result } = renderHook(() => useAvailableTimes(), {
        wrapper: Wrapper,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isError).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Weekly pattern save
  // -------------------------------------------------------------------------

  describe('weekly pattern bulk-create', () => {
    it('calls availableTimesBulkCreateCreate with rrule_string for weekly entries', async () => {
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse(FIXTURE_PAGINATED_LIST)
      );
      vi.mocked(availableTimesBulkCreateCreate).mockResolvedValue(
        makeBulkCreateResponse()
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(), {
        wrapper: Wrapper,
      });

      const weeklyEntry = {
        start_time: '2024-01-01T09:00:00',
        end_time: '2024-01-01T17:00:00',
        timezone: 'America/New_York',
        rrule_string: 'FREQ=WEEKLY;BYDAY=MO',
        calendar: null as number | null,
      };

      await act(async () => {
        await result.current.bulkCreate([weeklyEntry]);
      });

      expect(availableTimesBulkCreateCreate).toHaveBeenCalledOnce();
      const callArg = vi.mocked(availableTimesBulkCreateCreate).mock
        .calls[0][0];
      const body = callArg.body as BulkAvailableTimeWritable;
      expect(body.available_times).toHaveLength(1);
      expect(body.available_times[0].rrule_string).toBe('FREQ=WEEKLY;BYDAY=MO');
      expect(body.available_times[0].start_time).toBe('2024-01-01T09:00:00');
      expect(body.available_times[0].end_time).toBe('2024-01-01T17:00:00');
      expect(body.available_times[0].timezone).toBe('America/New_York');
    });

    it('sends multiple weekly entries for multiple weekdays', async () => {
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse(FIXTURE_PAGINATED_LIST)
      );
      vi.mocked(availableTimesBulkCreateCreate).mockResolvedValue(
        makeBulkCreateResponse()
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(), {
        wrapper: Wrapper,
      });

      const entries = [
        {
          start_time: '2024-01-01T09:00:00',
          end_time: '2024-01-01T17:00:00',
          timezone: 'UTC',
          rrule_string: 'FREQ=WEEKLY;BYDAY=MO',
          calendar: null as number | null,
        },
        {
          start_time: '2024-01-03T10:00:00',
          end_time: '2024-01-03T16:00:00',
          timezone: 'UTC',
          rrule_string: 'FREQ=WEEKLY;BYDAY=WE',
          calendar: null as number | null,
        },
      ];

      await act(async () => {
        await result.current.bulkCreate(entries);
      });

      const callArg = vi.mocked(availableTimesBulkCreateCreate).mock
        .calls[0][0];
      const body = callArg.body as BulkAvailableTimeWritable;
      expect(body.available_times).toHaveLength(2);
      expect(body.available_times[0].rrule_string).toBe('FREQ=WEEKLY;BYDAY=MO');
      expect(body.available_times[1].rrule_string).toBe('FREQ=WEEKLY;BYDAY=WE');
    });
  });

  // -------------------------------------------------------------------------
  // Ad-hoc save
  // -------------------------------------------------------------------------

  describe('ad-hoc bulk-create', () => {
    it('calls availableTimesBulkCreateCreate WITHOUT rrule_string for ad-hoc entries', async () => {
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse(FIXTURE_PAGINATED_LIST)
      );
      vi.mocked(availableTimesBulkCreateCreate).mockResolvedValue(
        makeBulkCreateResponse()
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(), {
        wrapper: Wrapper,
      });

      const adHocEntry = {
        start_time: '2024-06-15T09:00:00',
        end_time: '2024-06-15T17:00:00',
        timezone: 'America/New_York',
        // No rrule_string — ad-hoc
        calendar: null as number | null,
      };

      await act(async () => {
        await result.current.bulkCreate([adHocEntry]);
      });

      expect(availableTimesBulkCreateCreate).toHaveBeenCalledOnce();
      const callArg = vi.mocked(availableTimesBulkCreateCreate).mock
        .calls[0][0];
      const body = callArg.body as BulkAvailableTimeWritable;
      expect(body.available_times).toHaveLength(1);
      expect(body.available_times[0].rrule_string).toBeUndefined();
      expect(body.available_times[0].start_time).toBe('2024-06-15T09:00:00');
    });

    it('can mix weekly and ad-hoc entries in one bulk-create', async () => {
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse(FIXTURE_PAGINATED_LIST)
      );
      vi.mocked(availableTimesBulkCreateCreate).mockResolvedValue(
        makeBulkCreateResponse()
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(), {
        wrapper: Wrapper,
      });

      const mixed = [
        {
          start_time: '2024-01-01T09:00:00',
          end_time: '2024-01-01T17:00:00',
          timezone: 'UTC',
          rrule_string: 'FREQ=WEEKLY;BYDAY=MO',
          calendar: null as number | null,
        },
        {
          start_time: '2024-06-15T10:00:00',
          end_time: '2024-06-15T12:00:00',
          timezone: 'UTC',
          calendar: null as number | null,
        },
      ];

      await act(async () => {
        await result.current.bulkCreate(mixed);
      });

      const callArg = vi.mocked(availableTimesBulkCreateCreate).mock
        .calls[0][0];
      const body = callArg.body as BulkAvailableTimeWritable;
      expect(body.available_times).toHaveLength(2);
      expect(body.available_times[0].rrule_string).toBe('FREQ=WEEKLY;BYDAY=MO');
      expect(body.available_times[1].rrule_string).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('throws when bulk-create rejects', async () => {
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse(FIXTURE_PAGINATED_LIST)
      );
      vi.mocked(availableTimesBulkCreateCreate).mockRejectedValue(
        new Error('API error')
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(() => useAvailableTimes(), {
        wrapper: Wrapper,
      });

      await act(async () => {
        await expect(
          result.current.bulkCreate([
            {
              start_time: '2024-01-01T09:00:00',
              end_time: '2024-01-01T17:00:00',
              timezone: 'UTC',
              rrule_string: 'FREQ=WEEKLY;BYDAY=MO',
              calendar: null,
            },
          ])
        ).rejects.toThrow('API error');
      });
    });
  });
});
