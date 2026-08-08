/**
 * useOwnedCalendarIds tests.
 *
 * Covers:
 * - Requests calendarList scoped to owner='me'
 * - Returns the fetched calendars' ids as a Set
 * - Respects enabled:false (no fetch, empty set)
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
    calendarList: vi.fn(),
  };
});

import { calendarList } from '@/client/sdk.gen';
import { useOwnedCalendarIds } from './use-owned-calendar-ids';
import type { Calendar, PaginatedCalendarList } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function calendar(id: number): Calendar {
  return {
    id,
    name: `Calendar ${id}`,
    email: `calendar-${id}@example.com`,
    external_id: `ext-${id}`,
    provider: 'google',
    calendar_type: 'personal',
  };
}

function makeResponse(
  results: PaginatedCalendarList['results']
): Awaited<ReturnType<typeof calendarList>> {
  const body: PaginatedCalendarList = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarList>>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  }
  return Wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useOwnedCalendarIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests the list scoped to owner='me'", async () => {
    vi.mocked(calendarList).mockResolvedValue(makeResponse([calendar(1)]));

    const { result } = renderHook(() => useOwnedCalendarIds(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const query = vi.mocked(calendarList).mock.calls[0][0]?.query as {
      owner?: string;
    };
    expect(query?.owner).toBe('me');
  });

  it('returns the fetched calendars ids as a Set', async () => {
    vi.mocked(calendarList).mockResolvedValue(
      makeResponse([calendar(100), calendar(101)])
    );

    const { result } = renderHook(() => useOwnedCalendarIds(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.ownedCalendarIds).toEqual(new Set([100, 101]));
  });

  it('does not fetch when disabled, and returns an empty set', () => {
    const { result } = renderHook(
      () => useOwnedCalendarIds({ enabled: false }),
      { wrapper: makeWrapper() }
    );

    expect(vi.mocked(calendarList)).not.toHaveBeenCalled();
    expect(result.current.ownedCalendarIds).toEqual(new Set());
    expect(result.current.isLoading).toBe(false);
  });
});
