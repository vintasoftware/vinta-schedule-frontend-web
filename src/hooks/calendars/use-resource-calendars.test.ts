/**
 * useResourceCalendars tests.
 *
 * Covers:
 * - Requests calendarList scoped to calendar_type=resource
 * - Returns only active resources (filters out unlisted/inactive)
 * - Respects enabled:false (no fetch)
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
import { useResourceCalendars } from './use-resource-calendars';
import type { Calendar, PaginatedCalendarList } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function resource(id: number, visibility: Calendar['visibility']): Calendar {
  return {
    id,
    name: `Resource ${id}`,
    email: `resource-${id}@example.com`,
    external_id: `ext-${id}`,
    provider: 'internal',
    calendar_type: 'resource',
    capacity: 10,
    visibility,
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
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useResourceCalendars', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the list scoped to calendar_type=resource', async () => {
    vi.mocked(calendarList).mockResolvedValue(
      makeResponse([resource(1, 'active')])
    );

    const { result } = renderHook(() => useResourceCalendars(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const query = vi.mocked(calendarList).mock.calls[0][0]?.query as {
      calendar_type?: string;
    };
    expect(query?.calendar_type).toBe('resource');
  });

  it('returns only active resources', async () => {
    vi.mocked(calendarList).mockResolvedValue(
      makeResponse([
        resource(1, 'active'),
        resource(2, 'unlisted'),
        resource(3, 'inactive'),
        resource(4, 'active'),
      ])
    );

    const { result } = renderHook(() => useResourceCalendars(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.calendars.map((c) => c.id)).toEqual([1, 4]);
  });

  it('does not fetch when disabled', () => {
    renderHook(() => useResourceCalendars({ enabled: false }), {
      wrapper: makeWrapper(),
    });

    expect(vi.mocked(calendarList)).not.toHaveBeenCalled();
  });
});
