/**
 * useGroupAvailabilityPreview tests.
 *
 * Covers:
 * - buildDayRanges: a picked date range splits into one full-day range per
 *   day, in the requested zone; an inverted or invalid range yields no
 *   ranges at all.
 * - reduceAvailabilityToDays: the response reduces to the right per-day
 *   free/not-free answer for the calendar in question, including a day
 *   whose response entry never mentions the slot at all.
 * - the hook: the request's `ranges` body is built from the picked range,
 *   and — the laziness requirement this phase exists to prove — the query
 *   does NOT fire while `enabled` is false, only once it flips to `true`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { CalendarGroupRangeAvailability } from '@/client';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarGroupsAvailabilityCreate: vi.fn(),
  };
});

import { calendarGroupsAvailabilityCreate } from '@/client/sdk.gen';
import {
  useGroupAvailabilityPreview,
  buildDayRanges,
  reduceAvailabilityToDays,
} from './use-group-availability-preview';

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
  return { Wrapper, queryClient };
}

function makeResponse(results: CalendarGroupRangeAvailability[]) {
  const body = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarGroupsAvailabilityCreate>>;
}

// ---------------------------------------------------------------------------
// buildDayRanges
// ---------------------------------------------------------------------------

describe('buildDayRanges', () => {
  it('splits an inclusive multi-day range into one full-day range per day', () => {
    const ranges = buildDayRanges('2026-08-10', '2026-08-13', 'UTC');

    expect(ranges.map((r) => r.date)).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
    ]);
    // Each range spans exactly its own day, midnight to midnight.
    expect(ranges[0]).toEqual({
      date: '2026-08-10',
      startTime: '2026-08-10T00:00:00.000Z',
      endTime: '2026-08-11T00:00:00.000Z',
    });
    expect(ranges[3]).toEqual({
      date: '2026-08-13',
      startTime: '2026-08-13T00:00:00.000Z',
      endTime: '2026-08-14T00:00:00.000Z',
    });
  });

  it('a single-day range (start === end) produces exactly one range', () => {
    const ranges = buildDayRanges('2026-08-10', '2026-08-10', 'UTC');
    expect(ranges).toHaveLength(1);
    expect(ranges[0]?.date).toBe('2026-08-10');
  });

  it('an inverted range (end before start) produces no ranges', () => {
    expect(buildDayRanges('2026-08-13', '2026-08-10', 'UTC')).toEqual([]);
  });

  it('an unparseable date produces no ranges', () => {
    expect(buildDayRanges('not-a-date', '2026-08-10', 'UTC')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// reduceAvailabilityToDays
// ---------------------------------------------------------------------------

describe('reduceAvailabilityToDays', () => {
  const dayRanges = buildDayRanges('2026-08-10', '2026-08-11', 'UTC');
  const SLOT_ID = 10;
  const CALENDAR_ID = 42;
  const OTHER_CALENDAR_ID = 43;

  it('a day whose slot lists the calendar as available reduces to free', () => {
    const results: CalendarGroupRangeAvailability[] = [
      {
        start_time: dayRanges[0]!.startTime,
        end_time: dayRanges[0]!.endTime,
        slots: [
          {
            slot_id: SLOT_ID,
            available_calendar_ids: [CALENDAR_ID, OTHER_CALENDAR_ID],
            required_count: 1,
            is_bookable: true,
          },
        ],
      },
      {
        start_time: dayRanges[1]!.startTime,
        end_time: dayRanges[1]!.endTime,
        slots: [
          {
            slot_id: SLOT_ID,
            available_calendar_ids: [OTHER_CALENDAR_ID],
            required_count: 1,
            is_bookable: true,
          },
        ],
      },
    ];

    const days = reduceAvailabilityToDays(
      dayRanges,
      results,
      SLOT_ID,
      CALENDAR_ID
    );

    expect(days).toEqual([
      { date: '2026-08-10', isFree: true },
      { date: '2026-08-11', isFree: false },
    ]);
  });

  it('a day whose response never mentions the slot reduces to not-free', () => {
    const results: CalendarGroupRangeAvailability[] = [
      {
        start_time: dayRanges[0]!.startTime,
        end_time: dayRanges[0]!.endTime,
        // A different slot entirely -- SLOT_ID is not among these.
        slots: [
          {
            slot_id: 999,
            available_calendar_ids: [CALENDAR_ID],
            required_count: 1,
            is_bookable: true,
          },
        ],
      },
    ];

    const days = reduceAvailabilityToDays(
      [dayRanges[0]!],
      results,
      SLOT_ID,
      CALENDAR_ID
    );

    expect(days).toEqual([{ date: '2026-08-10', isFree: false }]);
  });

  it('a day missing from the response entirely reduces to not-free (positional fallback finds no match)', () => {
    const days = reduceAvailabilityToDays(dayRanges, [], SLOT_ID, CALENDAR_ID);
    expect(days).toEqual([
      { date: '2026-08-10', isFree: false },
      { date: '2026-08-11', isFree: false },
    ]);
  });
});

// ---------------------------------------------------------------------------
// useGroupAvailabilityPreview
// ---------------------------------------------------------------------------

describe('useGroupAvailabilityPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT fire the request while enabled is false', async () => {
    vi.mocked(calendarGroupsAvailabilityCreate).mockResolvedValue(
      makeResponse([])
    );
    const { Wrapper } = makeQueryWrapper();

    const { result, rerender } = renderHook(
      (props: { enabled: boolean }) =>
        useGroupAvailabilityPreview({
          groupId: 1,
          slotId: 10,
          calendarId: 42,
          startDate: '2026-08-10',
          endDate: '2026-08-11',
          timezone: 'UTC',
          enabled: props.enabled,
        }),
      { wrapper: Wrapper, initialProps: { enabled: false } }
    );

    // Give any accidental eager fetch a chance to happen before asserting
    // its absence -- asserting immediately after render could pass even if
    // the query fired asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calendarGroupsAvailabilityCreate).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);

    rerender({ enabled: true });

    await waitFor(() =>
      expect(calendarGroupsAvailabilityCreate).toHaveBeenCalledTimes(1)
    );
  });

  it('builds the request ranges from the picked date range and reduces the response for the calendar in question', async () => {
    vi.mocked(calendarGroupsAvailabilityCreate).mockImplementation(
      (async (options: {
        body: { ranges: { start_time: string; end_time: string }[] };
      }) => {
        const ranges = options.body.ranges;
        const results = ranges.map((r, index) => ({
          start_time: r.start_time,
          end_time: r.end_time,
          slots: [
            {
              slot_id: 10,
              // Every OTHER day is free, so this asserts BOTH values occur
              // (a mock that always answers the same way couldn't support
              // this assertion).
              available_calendar_ids: index % 2 === 0 ? [42] : [],
              required_count: 1,
              is_bookable: index % 2 === 0,
            },
          ],
        }));
        return makeResponse(results);
      }) as typeof calendarGroupsAvailabilityCreate
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(
      () =>
        useGroupAvailabilityPreview({
          groupId: 1,
          slotId: 10,
          calendarId: 42,
          startDate: '2026-08-10',
          endDate: '2026-08-13',
          timezone: 'UTC',
          enabled: true,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(calendarGroupsAvailabilityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: '1' },
        body: {
          ranges: [
            {
              start_time: '2026-08-10T00:00:00.000Z',
              end_time: '2026-08-11T00:00:00.000Z',
            },
            {
              start_time: '2026-08-11T00:00:00.000Z',
              end_time: '2026-08-12T00:00:00.000Z',
            },
            {
              start_time: '2026-08-12T00:00:00.000Z',
              end_time: '2026-08-13T00:00:00.000Z',
            },
            {
              start_time: '2026-08-13T00:00:00.000Z',
              end_time: '2026-08-14T00:00:00.000Z',
            },
          ],
        },
      })
    );

    expect(result.current.days).toEqual([
      { date: '2026-08-10', isFree: true },
      { date: '2026-08-11', isFree: false },
      { date: '2026-08-12', isFree: true },
      { date: '2026-08-13', isFree: false },
    ]);
    expect(result.current.hasAnyFreeDay).toBe(true);
  });

  it('an empty picked range (invalid dates) never issues a request even when enabled', async () => {
    vi.mocked(calendarGroupsAvailabilityCreate).mockResolvedValue(
      makeResponse([])
    );
    const { Wrapper } = makeQueryWrapper();

    const { result } = renderHook(
      () =>
        useGroupAvailabilityPreview({
          groupId: 1,
          slotId: 10,
          calendarId: 42,
          startDate: '2026-08-13',
          endDate: '2026-08-10', // inverted -- buildDayRanges yields []
          timezone: 'UTC',
          enabled: true,
        }),
      { wrapper: Wrapper }
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calendarGroupsAvailabilityCreate).not.toHaveBeenCalled();
    expect(result.current.days).toEqual([]);
  });
});
