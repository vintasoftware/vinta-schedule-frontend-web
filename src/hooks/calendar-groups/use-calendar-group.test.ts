/**
 * useCalendarGroup tests.
 *
 * Covers:
 * - 200 → returns the group, isNotFound:false
 * - 404 → returns null + isNotFound:true, NOT an error (non-disclosure state)
 * - Other non-ok → isError:true
 * - Rejection (network failure) → isError:true
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
    calendarGroupsRetrieve: vi.fn(),
  };
});

import { calendarGroupsRetrieve } from '@/client/sdk.gen';
import { useCalendarGroup } from './use-calendar-group';
import type { CalendarGroup } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_GROUP: CalendarGroup = {
  id: 1,
  name: 'Surgery Team',
  description: 'Operating room coverage',
  slots: [],
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type GroupRetrieveResult = Awaited<ReturnType<typeof calendarGroupsRetrieve>>;

function makeOkResponse(group: CalendarGroup): GroupRetrieveResult {
  return {
    data: group,
    response: new Response(JSON.stringify(group), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as GroupRetrieveResult;
}

function make404Response(): GroupRetrieveResult {
  return {
    data: undefined,
    response: new Response(JSON.stringify({ detail: 'Not found.' }), {
      status: 404,
    }),
  } as unknown as GroupRetrieveResult;
}

function make500Response(): GroupRetrieveResult {
  return {
    data: undefined,
    response: new Response(null, { status: 500 }),
  } as unknown as GroupRetrieveResult;
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

describe('useCalendarGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the group and isNotFound:false on 200', async () => {
    vi.mocked(calendarGroupsRetrieve).mockResolvedValue(
      makeOkResponse(FIXTURE_GROUP)
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useCalendarGroup('1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.group).toEqual(FIXTURE_GROUP);
    expect(result.current.isNotFound).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('maps 404 to isNotFound:true, NOT an error', async () => {
    vi.mocked(calendarGroupsRetrieve).mockResolvedValue(make404Response());

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useCalendarGroup('999'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.group).toBeNull();
    expect(result.current.isNotFound).toBe(true);
    // 404 is a normal, handled state — must NOT be flagged as an error.
    expect(result.current.isError).toBe(false);
  });

  it('sets isError:true (and isNotFound:false) on a non-404 error status', async () => {
    vi.mocked(calendarGroupsRetrieve).mockResolvedValue(make500Response());

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useCalendarGroup('1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.isNotFound).toBe(false);
    expect(result.current.group).toBeNull();
  });

  it('sets isError:true when calendarGroupsRetrieve rejects', async () => {
    vi.mocked(calendarGroupsRetrieve).mockRejectedValue(
      new Error('Network error')
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useCalendarGroup('1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.isNotFound).toBe(false);
  });
});
