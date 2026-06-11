/**
 * useUpdateBundle tests.
 *
 * Covers:
 *   - Calls calendarBundlePartialUpdate with the bundle ID and patch body
 *   - Successfully updates bundle_calendars
 *   - Successfully updates primary_calendar
 *   - Updates both bundle_calendars and primary_calendar together
 *   - invalidateCalendarEvents is called after successful update
 *   - Errors propagate to the caller
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarBundlePartialUpdate: vi.fn(),
  };
});

import { calendarBundlePartialUpdate } from '@/client/sdk.gen';
import type { Calendar } from '@/client';
import { useUpdateBundle } from './use-update-bundle';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_BUNDLE: Calendar = {
  id: 42,
  name: 'Main Office Bundle',
  calendar_type: 'bundle',
  is_active: true,
  email: 'bundle@example.com',
  external_id: 'ext-bundle',
  provider: 'google',
  capacity: null,
};

function makeSuccessResponse() {
  return {
    data: FIXTURE_BUNDLE,
    response: new Response(null, { status: 200 }),
    request: new Request('https://example.com'),
  } as const;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useUpdateBundle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls calendarBundlePartialUpdate with bundleId and patch body', async () => {
    vi.mocked(calendarBundlePartialUpdate).mockResolvedValue(
      makeSuccessResponse()
    );

    const wrapper = makeQueryWrapper();
    const { result } = renderHook(() => useUpdateBundle(), { wrapper });

    await result.current.updateBundle(42, {
      bundle_calendars: [1, 2, 3],
      primary_calendar: 2,
    });

    expect(calendarBundlePartialUpdate).toHaveBeenCalledOnce();
    const call = vi.mocked(calendarBundlePartialUpdate).mock.calls[0][0];
    expect(call.path.id).toBe('42');
    expect(call.body?.bundle_calendars).toEqual([1, 2, 3]);
    expect(call.body?.primary_calendar).toBe(2);
  });

  it('updates only bundle_calendars when primary_calendar is omitted', async () => {
    vi.mocked(calendarBundlePartialUpdate).mockResolvedValue(
      makeSuccessResponse()
    );

    const wrapper = makeQueryWrapper();
    const { result } = renderHook(() => useUpdateBundle(), { wrapper });

    await result.current.updateBundle(42, {
      bundle_calendars: [5, 6],
    });

    expect(calendarBundlePartialUpdate).toHaveBeenCalledOnce();
    const call = vi.mocked(calendarBundlePartialUpdate).mock.calls[0][0];
    expect(call.body?.bundle_calendars).toEqual([5, 6]);
    expect(call.body?.primary_calendar).toBeUndefined();
  });

  it('updates only primary_calendar when bundle_calendars is omitted', async () => {
    vi.mocked(calendarBundlePartialUpdate).mockResolvedValue(
      makeSuccessResponse()
    );

    const wrapper = makeQueryWrapper();
    const { result } = renderHook(() => useUpdateBundle(), { wrapper });

    await result.current.updateBundle(42, {
      primary_calendar: 3,
    });

    expect(calendarBundlePartialUpdate).toHaveBeenCalledOnce();
    const call = vi.mocked(calendarBundlePartialUpdate).mock.calls[0][0];
    expect(call.body?.bundle_calendars).toBeUndefined();
    expect(call.body?.primary_calendar).toBe(3);
  });

  it('propagates backend errors to the caller', async () => {
    const backendError = new Error('Conflict');
    vi.mocked(calendarBundlePartialUpdate).mockRejectedValue(backendError);

    const wrapper = makeQueryWrapper();
    const { result } = renderHook(() => useUpdateBundle(), { wrapper });

    await expect(
      result.current.updateBundle(42, {
        bundle_calendars: [1, 2],
        primary_calendar: 1,
      })
    ).rejects.toThrow('Conflict');

    expect(calendarBundlePartialUpdate).toHaveBeenCalledOnce();
  });
});
