/**
 * useDefaultCalendar tests.
 *
 * Covers:
 * - 200 → returns calendar + hasDefault:true
 * - 404 → returns null + hasDefault:false (normal onboarding state, not an error)
 * - Other non-ok → isError:true
 * - disabled when enabled:false
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
    calendarDefaultRetrieve: vi.fn(),
  };
});

import { calendarDefaultRetrieve } from '@/client/sdk.gen';
import { useDefaultCalendar } from './use-default-calendar';
import type { Calendar } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_CALENDAR: Calendar = {
  id: 42,
  name: 'Work Calendar',
  email: 'user@example.com',
  external_id: 'ext-42',
  provider: 'google',
  calendar_type: 'personal',
  capacity: null,
  manage_available_windows: false,
  visibility: 'active',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CalendarRetrieveResult = Awaited<
  ReturnType<typeof calendarDefaultRetrieve>
>;

function makeOkResponse(calendar: Calendar): CalendarRetrieveResult {
  return {
    data: calendar,
    response: new Response(JSON.stringify(calendar), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as CalendarRetrieveResult;
}

function make404Response(): CalendarRetrieveResult {
  return {
    data: undefined,
    response: new Response(null, { status: 404 }),
  } as unknown as CalendarRetrieveResult;
}

function make500Response(): CalendarRetrieveResult {
  return {
    data: undefined,
    response: new Response(null, { status: 500 }),
  } as unknown as CalendarRetrieveResult;
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

describe('useDefaultCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 200 OK → calendar returned
  // -------------------------------------------------------------------------

  it('returns the calendar and hasDefault:true on 200', async () => {
    vi.mocked(calendarDefaultRetrieve).mockResolvedValue(
      makeOkResponse(FIXTURE_CALENDAR)
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useDefaultCalendar(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.defaultCalendar).toEqual(FIXTURE_CALENDAR);
    expect(result.current.hasDefault).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 404 → null sentinel, NOT an error
  // -------------------------------------------------------------------------

  it('returns null and hasDefault:false on 404 (no default calendar)', async () => {
    vi.mocked(calendarDefaultRetrieve).mockResolvedValue(make404Response());

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useDefaultCalendar(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.defaultCalendar).toBeNull();
    expect(result.current.hasDefault).toBe(false);
    // 404 is a normal state — must NOT be flagged as an error
    expect(result.current.isError).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Other error → isError:true
  // -------------------------------------------------------------------------

  it('sets isError:true when a non-404 error status is returned', async () => {
    vi.mocked(calendarDefaultRetrieve).mockResolvedValue(make500Response());

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useDefaultCalendar(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.defaultCalendar).toBeNull();
  });

  it('sets isError:true when calendarDefaultRetrieve rejects', async () => {
    vi.mocked(calendarDefaultRetrieve).mockRejectedValue(
      new Error('Network error')
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useDefaultCalendar(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
  });

  // -------------------------------------------------------------------------
  // disabled when enabled:false
  // -------------------------------------------------------------------------

  it('does not call the API when enabled is false', async () => {
    const { Wrapper } = makeQueryWrapper();
    renderHook(() => useDefaultCalendar({ enabled: false }), {
      wrapper: Wrapper,
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(calendarDefaultRetrieve).not.toHaveBeenCalled();
  });
});
