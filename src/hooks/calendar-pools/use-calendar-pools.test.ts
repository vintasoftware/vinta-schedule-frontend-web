/**
 * Calendar pool hook tests.
 *
 * Covers:
 * - useCalendarPools maps a DataTableQuery's page/pageSize to limit/offset and
 *   its search to the endpoint's `name` filter.
 * - useAllCalendarPools reports isTruncated when the org has more pools than
 *   one page holds, so a picker can say its options are incomplete.
 * - create / update / delete send the shapes the API expects.
 * - readPoolInUseError recognizes the delete-refused 409 body and rejects
 *   every other error shape, so a generic 400 is never read as "in use".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarPoolsList: vi.fn(),
    calendarPoolsCreate: vi.fn(),
    calendarPoolsPartialUpdate: vi.fn(),
    calendarPoolsDestroy: vi.fn(),
  };
});

import {
  calendarPoolsList,
  calendarPoolsCreate,
  calendarPoolsPartialUpdate,
  calendarPoolsDestroy,
} from '@/client/sdk.gen';
import {
  useCalendarPools,
  useAllCalendarPools,
  useCreateCalendarPool,
  useUpdateCalendarPool,
  useDeleteCalendarPool,
  readPoolInUseError,
  ALL_POOLS_PAGE_SIZE,
} from './use-calendar-pools';
import type { CalendarPool } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePool(id: number, name: string): CalendarPool {
  return {
    id,
    name,
    description: '',
    calendars: [],
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  };
}

const POOL_NURSES = makePool(7, 'Nurses');

function mockList(results: CalendarPool[], count = results.length) {
  vi.mocked(calendarPoolsList).mockResolvedValue({
    data: { count, results },
    response: new Response('{}', { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarPoolsList>>);
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCalendarPools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps page/pageSize to limit/offset and search to the name filter', async () => {
    mockList([POOL_NURSES], 31);

    const { result } = renderHook(
      () =>
        useCalendarPools({
          query: { page: 3, pageSize: 10, ordering: null, search: 'nur' },
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(vi.mocked(calendarPoolsList).mock.calls[0]?.[0]?.query).toEqual({
      limit: 10,
      offset: 20,
      name: 'nur',
    });
    expect(result.current.pools).toEqual([POOL_NURSES]);
    expect(result.current.totalCount).toBe(31);
  });

  it('sends no name filter for an empty search string', async () => {
    mockList([]);

    const { result } = renderHook(
      () =>
        useCalendarPools({
          query: { page: 1, pageSize: 25, ordering: null, search: '' },
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(
      vi.mocked(calendarPoolsList).mock.calls[0]?.[0]?.query?.name
    ).toBeUndefined();
  });
});

describe('useAllCalendarPools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches one large page and reports isTruncated:false when it holds everything', async () => {
    mockList([POOL_NURSES], 1);

    const { result } = renderHook(() => useAllCalendarPools(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(vi.mocked(calendarPoolsList).mock.calls[0]?.[0]?.query).toEqual({
      limit: ALL_POOLS_PAGE_SIZE,
    });
    expect(result.current.isTruncated).toBe(false);
  });

  it('reports isTruncated when the org has more pools than the page returned', async () => {
    mockList([POOL_NURSES], 500);

    const { result } = renderHook(() => useAllCalendarPools(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isTruncated).toBe(true);
  });
});

describe('calendar pool mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList([]);
  });

  it('createCalendarPool posts the roster as a whole list', async () => {
    vi.mocked(calendarPoolsCreate).mockResolvedValue({
      data: POOL_NURSES,
      response: new Response('{}', { status: 201 }),
    } as unknown as Awaited<ReturnType<typeof calendarPoolsCreate>>);

    const { result } = renderHook(() => useCreateCalendarPool(), { wrapper });

    await result.current.createCalendarPool({
      name: 'Nurses',
      description: 'Ward staff',
      calendar_ids: [1, 2],
    });

    expect(vi.mocked(calendarPoolsCreate).mock.calls[0]?.[0]?.body).toEqual({
      name: 'Nurses',
      description: 'Ward staff',
      calendar_ids: [1, 2],
    });
  });

  it('updateCalendarPool patches by id with the replacement roster', async () => {
    vi.mocked(calendarPoolsPartialUpdate).mockResolvedValue({
      data: POOL_NURSES,
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof calendarPoolsPartialUpdate>>);

    const { result } = renderHook(() => useUpdateCalendarPool(), { wrapper });

    await result.current.updateCalendarPool(7, { calendar_ids: [3] });

    const call = vi.mocked(calendarPoolsPartialUpdate).mock.calls[0]?.[0];
    expect(call?.path).toEqual({ id: '7' });
    expect(call?.body).toEqual({ calendar_ids: [3] });
  });

  it('deleteCalendarPool deletes by id and lets a 409 rejection through to the caller', async () => {
    const conflict = {
      detail: 'Pool is still attached to a group slot.',
      groups: ['Clinic Appointments'],
    };
    vi.mocked(calendarPoolsDestroy).mockRejectedValue(conflict);

    const { result } = renderHook(() => useDeleteCalendarPool(), { wrapper });

    await expect(result.current.deleteCalendarPool(7)).rejects.toBe(conflict);
    expect(vi.mocked(calendarPoolsDestroy).mock.calls[0]?.[0]?.path).toEqual({
      id: '7',
    });
  });
});

describe('readPoolInUseError', () => {
  it('reads the detail and the referencing group names', () => {
    expect(
      readPoolInUseError({
        detail: 'Pool is still attached to a group slot.',
        groups: ['Clinic Appointments', 'Follow-ups'],
      })
    ).toEqual({
      detail: 'Pool is still attached to a group slot.',
      groups: ['Clinic Appointments', 'Follow-ups'],
    });
  });

  it('returns null for error shapes that are not the in-use refusal', () => {
    // A plain DRF validation error, a bare detail, a non-object, and a `groups`
    // array holding something other than names must all fall through — reading
    // any of them as "in use" would tell the user to detach groups that the
    // rejection never named.
    expect(
      readPoolInUseError({ name: ['This field is required.'] })
    ).toBeNull();
    expect(readPoolInUseError({ detail: 'Not found.' })).toBeNull();
    expect(readPoolInUseError({ detail: 'x', groups: [1, 2] })).toBeNull();
    expect(readPoolInUseError('boom')).toBeNull();
    expect(readPoolInUseError(null)).toBeNull();
  });
});
