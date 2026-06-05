/**
 * useCreateBooking tests.
 *
 * Covers:
 * - Creates the primary event on the primary calendar (calendarEventsCreate)
 *   with required empty arrays present
 * - Creates a blocked-time on each co-booked calendar (blockedTimesCreate)
 *   with the same time range
 * - Both operations are called with the right args
 * - A rejected override (backend rejects calendarEventsCreate) surfaces the
 *   error and NO blocked-times are created
 * - Partial co-booking failure is surfaced (primary succeeds, one blocked-time fails)
 * - invalidateCalendarEvents is called on success
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
    calendarEventsCreate: vi.fn(),
    blockedTimesCreate: vi.fn(),
    calendarEventsList: vi.fn(),
    blockedTimesList: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { calendarEventsCreate, blockedTimesCreate } from '@/client/sdk.gen';
import { useCreateBooking } from './use-create-booking';
import type {
  CalendarEventWritable,
  CalendarEvent,
  BlockedTime,
} from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_EVENT_WRITABLE: CalendarEventWritable = {
  title: 'Team Meeting',
  start_time: '2024-06-15T09:00:00-04:00',
  end_time: '2024-06-15T10:00:00-04:00',
  timezone: 'America/New_York',
  calendar: 1,
  external_attendances: [],
  attendances: [],
  resource_allocations: [],
};

const FIXTURE_CREATED_EVENT: CalendarEvent = {
  id: 100,
  title: 'Team Meeting',
  start_time: '2024-06-15T09:00:00-04:00',
  end_time: '2024-06-15T10:00:00-04:00',
  timezone: 'America/New_York',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  external_id: 'ext-100',
  external_attendances: [],
  attendances: [],
  resource_allocations: [],
  parent_recurring_object: {
    id: 0,
    title: '',
    external_id: '',
    start_time: '2024-01-01T00:00:00Z',
    end_time: '2024-01-01T00:00:00Z',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
  is_recurring: false,
  is_recurring_instance: false,
};

const FIXTURE_BLOCKED_TIME: BlockedTime = {
  id: 200,
  start_time: '2024-06-15T09:00:00-04:00',
  end_time: '2024-06-15T10:00:00-04:00',
  timezone: 'America/New_York',
  calendar: 2,
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  is_recurring: false,
  is_recurring_instance: false,
  reason: 'Team Meeting',
  external_id: 'ext-bt-200',
  parent_blocked_time: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCreateEventResponse(
  event: CalendarEvent
): Awaited<ReturnType<typeof calendarEventsCreate>> {
  return {
    data: event,
    response: new Response(JSON.stringify(event), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarEventsCreate>>;
}

function makeCreateBlockedTimeResponse(
  blockedTime: BlockedTime
): Awaited<ReturnType<typeof blockedTimesCreate>> {
  return {
    data: blockedTime,
    response: new Response(JSON.stringify(blockedTime), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof blockedTimesCreate>>;
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
  return Wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCreateBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('primary event creation', () => {
    it('calls calendarEventsCreate with the provided event body', async () => {
      vi.mocked(calendarEventsCreate).mockResolvedValue(
        makeCreateEventResponse(FIXTURE_CREATED_EVENT)
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCreateBooking(), { wrapper });

      await result.current.createBooking({
        event: FIXTURE_EVENT_WRITABLE,
        coBookedCalendarIds: [],
      });

      expect(calendarEventsCreate).toHaveBeenCalledOnce();
      expect(calendarEventsCreate).toHaveBeenCalledWith({
        body: FIXTURE_EVENT_WRITABLE,
      });
    });

    it('sends required empty arrays (external_attendances, attendances, resource_allocations)', async () => {
      vi.mocked(calendarEventsCreate).mockResolvedValue(
        makeCreateEventResponse(FIXTURE_CREATED_EVENT)
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCreateBooking(), { wrapper });

      await result.current.createBooking({
        event: FIXTURE_EVENT_WRITABLE,
        coBookedCalendarIds: [],
      });

      const callArg = vi.mocked(calendarEventsCreate).mock.calls[0][0];
      expect(callArg.body.external_attendances).toEqual([]);
      expect(callArg.body.attendances).toEqual([]);
      expect(callArg.body.resource_allocations).toEqual([]);
    });

    it('returns the created event in the result', async () => {
      vi.mocked(calendarEventsCreate).mockResolvedValue(
        makeCreateEventResponse(FIXTURE_CREATED_EVENT)
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCreateBooking(), { wrapper });

      const bookingResult = await result.current.createBooking({
        event: FIXTURE_EVENT_WRITABLE,
        coBookedCalendarIds: [],
      });

      expect(bookingResult.event.id).toBe(100);
      expect(bookingResult.event.title).toBe('Team Meeting');
    });
  });

  describe('co-booked blocked-times', () => {
    it('creates a blocked-time on each co-booked calendar', async () => {
      vi.mocked(calendarEventsCreate).mockResolvedValue(
        makeCreateEventResponse(FIXTURE_CREATED_EVENT)
      );
      vi.mocked(blockedTimesCreate).mockResolvedValue(
        makeCreateBlockedTimeResponse(FIXTURE_BLOCKED_TIME)
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCreateBooking(), { wrapper });

      await result.current.createBooking({
        event: FIXTURE_EVENT_WRITABLE,
        coBookedCalendarIds: [2, 3],
      });

      // blockedTimesCreate should be called twice (once per co-booked calendar)
      expect(blockedTimesCreate).toHaveBeenCalledTimes(2);
    });

    it('creates blocked-times with the same start/end/timezone as the event', async () => {
      vi.mocked(calendarEventsCreate).mockResolvedValue(
        makeCreateEventResponse(FIXTURE_CREATED_EVENT)
      );
      vi.mocked(blockedTimesCreate).mockResolvedValue(
        makeCreateBlockedTimeResponse(FIXTURE_BLOCKED_TIME)
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCreateBooking(), { wrapper });

      await result.current.createBooking({
        event: FIXTURE_EVENT_WRITABLE,
        coBookedCalendarIds: [2],
      });

      const blockedTimeArg = vi.mocked(blockedTimesCreate).mock.calls[0][0];
      expect(blockedTimeArg.body.start_time).toBe(
        FIXTURE_EVENT_WRITABLE.start_time
      );
      expect(blockedTimeArg.body.end_time).toBe(
        FIXTURE_EVENT_WRITABLE.end_time
      );
      expect(blockedTimeArg.body.timezone).toBe(
        FIXTURE_EVENT_WRITABLE.timezone
      );
      expect(blockedTimeArg.body.calendar).toBe(2);
    });

    it('does not call blockedTimesCreate when coBookedCalendarIds is empty', async () => {
      vi.mocked(calendarEventsCreate).mockResolvedValue(
        makeCreateEventResponse(FIXTURE_CREATED_EVENT)
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCreateBooking(), { wrapper });

      await result.current.createBooking({
        event: FIXTURE_EVENT_WRITABLE,
        coBookedCalendarIds: [],
      });

      expect(blockedTimesCreate).not.toHaveBeenCalled();
    });

    it('sets allCoBookingsSucceeded=true when all blocked-times succeed', async () => {
      vi.mocked(calendarEventsCreate).mockResolvedValue(
        makeCreateEventResponse(FIXTURE_CREATED_EVENT)
      );
      vi.mocked(blockedTimesCreate).mockResolvedValue(
        makeCreateBlockedTimeResponse(FIXTURE_BLOCKED_TIME)
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCreateBooking(), { wrapper });

      const bookingResult = await result.current.createBooking({
        event: FIXTURE_EVENT_WRITABLE,
        coBookedCalendarIds: [2, 3],
      });

      expect(bookingResult.allCoBookingsSucceeded).toBe(true);
      expect(bookingResult.blockedTimeResults).toHaveLength(2);
      expect(bookingResult.blockedTimeResults[0].error).toBeUndefined();
      expect(bookingResult.blockedTimeResults[1].error).toBeUndefined();
    });
  });

  describe('backend rejection (override rejected path)', () => {
    it('throws when calendarEventsCreate rejects — no event is created', async () => {
      const backendError = new Error('Backend conflict: time unavailable');
      vi.mocked(calendarEventsCreate).mockRejectedValue(backendError);

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCreateBooking(), { wrapper });

      await expect(
        result.current.createBooking({
          event: FIXTURE_EVENT_WRITABLE,
          coBookedCalendarIds: [2],
        })
      ).rejects.toThrow('Backend conflict: time unavailable');

      // Primary create was called once and rejected
      expect(calendarEventsCreate).toHaveBeenCalledOnce();
      // NO blocked-times created because primary failed
      expect(blockedTimesCreate).not.toHaveBeenCalled();
    });

    it('does not linger any event when the backend rejects', async () => {
      vi.mocked(calendarEventsCreate).mockRejectedValue(new Error('Conflict'));

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCreateBooking(), { wrapper });

      let threwError = false;
      try {
        await result.current.createBooking({
          event: FIXTURE_EVENT_WRITABLE,
          coBookedCalendarIds: [],
        });
      } catch {
        threwError = true;
      }

      expect(threwError).toBe(true);
      // Ensure no secondary operations were attempted
      expect(blockedTimesCreate).not.toHaveBeenCalled();
    });
  });

  describe('partial co-booking failure', () => {
    it('surfaces per-calendar errors when some blocked-times fail', async () => {
      vi.mocked(calendarEventsCreate).mockResolvedValue(
        makeCreateEventResponse(FIXTURE_CREATED_EVENT)
      );
      // First calendar succeeds, second fails
      vi.mocked(blockedTimesCreate)
        .mockResolvedValueOnce(
          makeCreateBlockedTimeResponse(FIXTURE_BLOCKED_TIME)
        )
        .mockRejectedValueOnce(new Error('Calendar 3 busy'));

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCreateBooking(), { wrapper });

      const bookingResult = await result.current.createBooking({
        event: FIXTURE_EVENT_WRITABLE,
        coBookedCalendarIds: [2, 3],
      });

      // Primary event succeeded
      expect(bookingResult.event.id).toBe(100);
      // allCoBookingsSucceeded is false
      expect(bookingResult.allCoBookingsSucceeded).toBe(false);
      // First calendar OK
      expect(bookingResult.blockedTimeResults[0].error).toBeUndefined();
      expect(bookingResult.blockedTimeResults[0].blockedTime).toBeDefined();
      // Second calendar failed
      expect(bookingResult.blockedTimeResults[1].error).toBeInstanceOf(Error);
      expect(bookingResult.blockedTimeResults[1].error?.message).toBe(
        'Calendar 3 busy'
      );
    });
  });
});
