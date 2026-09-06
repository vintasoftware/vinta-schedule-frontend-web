/**
 * useAppointmentTypeAvailabilityPreview tests.
 *
 * Covers:
 * - buildDayPlans: a picked date range splits into one plan per day, each
 *   carrying a probe per REPRESENTABLE appointment-type-scoped window whose weekday
 *   matches that day -- not a full midnight-to-midnight probe (BLOCKER fix:
 *   the backend only answers "available" for a range fully covered by a
 *   single span, so a full-day probe on a calendar configured e.g.
 *   "Tuesdays and Thursdays 9am-5pm" would report every day, including
 *   Tuesday and Thursday, as not free). A day whose weekday has no matching
 *   window gets zero probes; an invalid or inverted range yields no plans
 *   at all.
 * - reduceAvailabilityToDays: a day with no probes reduces to
 *   'unconfigured' without consulting the response at all; a day with
 *   probes reduces to 'free' when ANY of its probes reports the calendar
 *   free, 'not-free' otherwise -- including a day whose response entry
 *   never mentions the slot.
 * - the hook: the request's `ranges` body is built ONLY from probed
 *   sub-ranges (never a full day), and — the laziness requirement this
 *   phase exists to prove — neither the appointment-type-scoped windows list nor the
 *   availability request fires while `enabled` is false, only once it flips
 *   to `true`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type {
  AppointmentTypeRangeAvailability,
  AppointmentTypeScopedAvailabilityWindow,
} from '@/client';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    appointmentTypesAvailabilityCreate: vi.fn(),
    appointmentTypesSlotsAvailabilityWindowsList: vi.fn(),
  };
});

import {
  appointmentTypesAvailabilityCreate,
  appointmentTypesSlotsAvailabilityWindowsList,
} from '@/client/sdk.gen';
import {
  useAppointmentTypeAvailabilityPreview,
  buildDayPlans,
  reduceAvailabilityToDays,
  type DayPlan,
} from './use-appointment-type-availability-preview';
import type { WeekdayWindow } from '@/components/appointment-types/appointment-type-scoped-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APPOINTMENT_TYPE_ID = 1;
const SLOT_ID = 10;
const CALENDAR_ID = 42;

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

function makeAvailabilityResponse(results: AppointmentTypeRangeAvailability[]) {
  const body = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof appointmentTypesAvailabilityCreate>
  >;
}

// 2024-01-02 is a Tuesday -- same anchor convention as
// appointment-type-scoped-types.test.ts and appointment-type-window-grid.test.tsx.
function makeWindow(
  overrides: Partial<AppointmentTypeScopedAvailabilityWindow>
): AppointmentTypeScopedAvailabilityWindow {
  return {
    id: 1,
    calendar_id: CALENDAR_ID,
    appointment_type_slot_id: SLOT_ID,
    start_time: '2024-01-02T09:00:00Z',
    end_time: '2024-01-02T17:00:00Z',
    timezone: 'UTC',
    rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
    is_recurring: true,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeWindowsListResponse(
  results: AppointmentTypeScopedAvailabilityWindow[]
) {
  const body = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof appointmentTypesSlotsAvailabilityWindowsList>
  >;
}

// Tuesday-and-Thursday 9am-5pm UTC -- the plan's own UC-7 acceptance
// scenario. 2026-08-11 is a Tuesday, 2026-08-13 is a Thursday.
const TUE_THU_WINDOWS: WeekdayWindow[] = [
  { id: 1, weekday: 'TU', startTime: '09:00', endTime: '17:00' },
  { id: 2, weekday: 'TH', startTime: '09:00', endTime: '17:00' },
];

// ---------------------------------------------------------------------------
// buildDayPlans
// ---------------------------------------------------------------------------

describe('buildDayPlans', () => {
  it('gives every day in the picked range a plan, with probes only on days whose weekday has a matching window', () => {
    // 2026-08-10 Mon, 08-11 Tue, 08-12 Wed, 08-13 Thu.
    const plans = buildDayPlans(
      '2026-08-10',
      '2026-08-13',
      'UTC',
      TUE_THU_WINDOWS
    );

    expect(plans.map((p) => p.date)).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
    ]);
    expect(plans[0]?.probes).toEqual([]); // Monday -- no window
    expect(plans[1]?.probes).toEqual([
      {
        startTime: '2026-08-11T09:00:00.000Z',
        endTime: '2026-08-11T17:00:00.000Z',
      },
    ]); // Tuesday
    expect(plans[2]?.probes).toEqual([]); // Wednesday -- no window
    expect(plans[3]?.probes).toEqual([
      {
        startTime: '2026-08-13T09:00:00.000Z',
        endTime: '2026-08-13T17:00:00.000Z',
      },
    ]); // Thursday
  });

  it('a calendar with no windows at all produces a plan per day, every one with zero probes', () => {
    const plans = buildDayPlans('2026-08-10', '2026-08-11', 'UTC', []);
    expect(plans).toEqual([
      { date: '2026-08-10', probes: [] },
      { date: '2026-08-11', probes: [] },
    ]);
  });

  it('a weekday with more than one window produces one probe per window', () => {
    const windows: WeekdayWindow[] = [
      { id: 1, weekday: 'TU', startTime: '09:00', endTime: '12:00' },
      { id: 2, weekday: 'TU', startTime: '13:00', endTime: '17:00' },
    ];
    const plans = buildDayPlans('2026-08-11', '2026-08-11', 'UTC', windows);
    expect(plans[0]?.probes).toEqual([
      {
        startTime: '2026-08-11T09:00:00.000Z',
        endTime: '2026-08-11T12:00:00.000Z',
      },
      {
        startTime: '2026-08-11T13:00:00.000Z',
        endTime: '2026-08-11T17:00:00.000Z',
      },
    ]);
  });

  it('an inverted range (end before start) produces no plans', () => {
    expect(
      buildDayPlans('2026-08-13', '2026-08-10', 'UTC', TUE_THU_WINDOWS)
    ).toEqual([]);
  });

  it('an unparseable date produces no plans', () => {
    expect(
      buildDayPlans('not-a-date', '2026-08-10', 'UTC', TUE_THU_WINDOWS)
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// reduceAvailabilityToDays
// ---------------------------------------------------------------------------

describe('reduceAvailabilityToDays', () => {
  it('a day with no probes reduces to unconfigured without consulting the response', () => {
    const dayPlans: DayPlan[] = [{ date: '2026-08-10', probes: [] }];
    const days = reduceAvailabilityToDays(dayPlans, [], SLOT_ID, CALENDAR_ID);
    expect(days).toEqual([{ date: '2026-08-10', status: 'unconfigured' }]);
  });

  it('a day whose probe reports the calendar free reduces to free', () => {
    const dayPlans: DayPlan[] = [
      {
        date: '2026-08-11',
        probes: [
          {
            startTime: '2026-08-11T09:00:00.000Z',
            endTime: '2026-08-11T17:00:00.000Z',
          },
        ],
      },
    ];
    const results: AppointmentTypeRangeAvailability[] = [
      {
        start_time: '2026-08-11T09:00:00.000Z',
        end_time: '2026-08-11T17:00:00.000Z',
        slots: [
          {
            slot_id: SLOT_ID,
            available_calendar_ids: [CALENDAR_ID],
            required_count: 1,
            is_bookable: true,
          },
        ],
      },
    ];
    const days = reduceAvailabilityToDays(
      dayPlans,
      results,
      SLOT_ID,
      CALENDAR_ID
    );
    expect(days).toEqual([{ date: '2026-08-11', status: 'free' }]);
  });

  it('a day whose response never mentions the slot reduces to not-free', () => {
    const dayPlans: DayPlan[] = [
      {
        date: '2026-08-11',
        probes: [
          {
            startTime: '2026-08-11T09:00:00.000Z',
            endTime: '2026-08-11T17:00:00.000Z',
          },
        ],
      },
    ];
    const results: AppointmentTypeRangeAvailability[] = [
      {
        start_time: '2026-08-11T09:00:00.000Z',
        end_time: '2026-08-11T17:00:00.000Z',
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
      dayPlans,
      results,
      SLOT_ID,
      CALENDAR_ID
    );
    expect(days).toEqual([{ date: '2026-08-11', status: 'not-free' }]);
  });

  it('a day missing from the response entirely reduces to not-free (positional fallback finds no match)', () => {
    const dayPlans: DayPlan[] = [
      {
        date: '2026-08-11',
        probes: [
          {
            startTime: '2026-08-11T09:00:00.000Z',
            endTime: '2026-08-11T17:00:00.000Z',
          },
        ],
      },
    ];
    const days = reduceAvailabilityToDays(dayPlans, [], SLOT_ID, CALENDAR_ID);
    expect(days).toEqual([{ date: '2026-08-11', status: 'not-free' }]);
  });

  it('a day free on ANY of its probes reduces to free, even when another probe that day is not free', () => {
    const dayPlans: DayPlan[] = [
      {
        date: '2026-08-11',
        probes: [
          {
            startTime: '2026-08-11T09:00:00.000Z',
            endTime: '2026-08-11T12:00:00.000Z',
          },
          {
            startTime: '2026-08-11T13:00:00.000Z',
            endTime: '2026-08-11T17:00:00.000Z',
          },
        ],
      },
    ];
    const results: AppointmentTypeRangeAvailability[] = [
      {
        start_time: '2026-08-11T09:00:00.000Z',
        end_time: '2026-08-11T12:00:00.000Z',
        slots: [
          {
            slot_id: SLOT_ID,
            available_calendar_ids: [],
            required_count: 1,
            is_bookable: false,
          },
        ],
      },
      {
        start_time: '2026-08-11T13:00:00.000Z',
        end_time: '2026-08-11T17:00:00.000Z',
        slots: [
          {
            slot_id: SLOT_ID,
            available_calendar_ids: [CALENDAR_ID],
            required_count: 1,
            is_bookable: true,
          },
        ],
      },
    ];
    const days = reduceAvailabilityToDays(
      dayPlans,
      results,
      SLOT_ID,
      CALENDAR_ID
    );
    expect(days).toEqual([{ date: '2026-08-11', status: 'free' }]);
  });
});

// ---------------------------------------------------------------------------
// useAppointmentTypeAvailabilityPreview
// ---------------------------------------------------------------------------

describe('useAppointmentTypeAvailabilityPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT fire either request while enabled is false', async () => {
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeWindowsListResponse(
        TUE_THU_WINDOWS.map((w) => makeWindow({ id: w.id }))
      )
    );
    vi.mocked(appointmentTypesAvailabilityCreate).mockResolvedValue(
      makeAvailabilityResponse([])
    );
    const { Wrapper } = makeQueryWrapper();

    const { result, rerender } = renderHook(
      (props: { enabled: boolean }) =>
        useAppointmentTypeAvailabilityPreview({
          appointmentTypeId: APPOINTMENT_TYPE_ID,
          slotId: SLOT_ID,
          calendarId: CALENDAR_ID,
          startDate: '2026-08-10',
          endDate: '2026-08-13',
          timezone: 'UTC',
          enabled: props.enabled,
        }),
      { wrapper: Wrapper, initialProps: { enabled: false } }
    );

    // Give any accidental eager fetch a chance to happen before asserting
    // its absence -- asserting immediately after render could pass even if
    // the query fired asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(appointmentTypesSlotsAvailabilityWindowsList).not.toHaveBeenCalled();
    expect(appointmentTypesAvailabilityCreate).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);

    rerender({ enabled: true });

    await waitFor(() =>
      expect(appointmentTypesAvailabilityCreate).toHaveBeenCalledTimes(1)
    );
  });

  it('builds the request ranges from ONLY the days whose weekday has a matching window, and reduces the response per day', async () => {
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeWindowsListResponse([
        makeWindow({ id: 1 }), // Tuesday 09:00-17:00
        makeWindow({
          id: 2,
          rrule_string: 'FREQ=WEEKLY;BYDAY=TH',
          start_time: '2024-01-04T09:00:00Z', // Thursday
          end_time: '2024-01-04T17:00:00Z',
        }),
      ])
    );
    vi.mocked(appointmentTypesAvailabilityCreate).mockImplementation(
      (async (options: {
        body: { ranges: { start_time: string; end_time: string }[] };
      }) => {
        const ranges = options.body.ranges;
        const results = ranges.map((r, index) => ({
          start_time: r.start_time,
          end_time: r.end_time,
          slots: [
            {
              slot_id: SLOT_ID,
              // Tuesday free, Thursday not -- asserts both values occur.
              available_calendar_ids: index === 0 ? [CALENDAR_ID] : [],
              required_count: 1,
              is_bookable: index === 0,
            },
          ],
        }));
        return makeAvailabilityResponse(results);
      }) as typeof appointmentTypesAvailabilityCreate
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(
      () =>
        useAppointmentTypeAvailabilityPreview({
          appointmentTypeId: APPOINTMENT_TYPE_ID,
          slotId: SLOT_ID,
          calendarId: CALENDAR_ID,
          startDate: '2026-08-10',
          endDate: '2026-08-13',
          timezone: 'UTC',
          enabled: true,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(appointmentTypesAvailabilityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: String(APPOINTMENT_TYPE_ID) },
        body: {
          ranges: [
            {
              start_time: '2026-08-11T09:00:00.000Z',
              end_time: '2026-08-11T17:00:00.000Z',
            },
            {
              start_time: '2026-08-13T09:00:00.000Z',
              end_time: '2026-08-13T17:00:00.000Z',
            },
          ],
        },
      })
    );

    expect(result.current.days).toEqual([
      { date: '2026-08-10', status: 'unconfigured' }, // Monday, no window
      { date: '2026-08-11', status: 'free' }, // Tuesday
      { date: '2026-08-12', status: 'unconfigured' }, // Wednesday, no window
      { date: '2026-08-13', status: 'not-free' }, // Thursday
    ]);
    expect(result.current.hasAnyFreeDay).toBe(true);
  });

  it('a calendar with no representable appointment-type-scoped window at all never issues the availability request', async () => {
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeWindowsListResponse([])
    );
    vi.mocked(appointmentTypesAvailabilityCreate).mockResolvedValue(
      makeAvailabilityResponse([])
    );
    const { Wrapper } = makeQueryWrapper();

    const { result } = renderHook(
      () =>
        useAppointmentTypeAvailabilityPreview({
          appointmentTypeId: APPOINTMENT_TYPE_ID,
          slotId: SLOT_ID,
          calendarId: CALENDAR_ID,
          startDate: '2026-08-10',
          endDate: '2026-08-11',
          timezone: 'UTC',
          enabled: true,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(appointmentTypesAvailabilityCreate).not.toHaveBeenCalled();
    expect(result.current.days).toEqual([
      { date: '2026-08-10', status: 'unconfigured' },
      { date: '2026-08-11', status: 'unconfigured' },
    ]);
  });

  it('an empty picked range (invalid dates) never issues either request even when enabled', async () => {
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeWindowsListResponse(
        TUE_THU_WINDOWS.map((w) => makeWindow({ id: w.id }))
      )
    );
    vi.mocked(appointmentTypesAvailabilityCreate).mockResolvedValue(
      makeAvailabilityResponse([])
    );
    const { Wrapper } = makeQueryWrapper();

    const { result } = renderHook(
      () =>
        useAppointmentTypeAvailabilityPreview({
          appointmentTypeId: APPOINTMENT_TYPE_ID,
          slotId: SLOT_ID,
          calendarId: CALENDAR_ID,
          startDate: '2026-08-13',
          endDate: '2026-08-10', // inverted -- buildDayPlans yields []
          timezone: 'UTC',
          enabled: true,
        }),
      { wrapper: Wrapper }
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(appointmentTypesAvailabilityCreate).not.toHaveBeenCalled();
    expect(result.current.days).toEqual([]);
  });
});
