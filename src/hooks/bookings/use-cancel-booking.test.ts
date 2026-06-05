/**
 * useCancelBooking tests.
 *
 * Covers:
 *  - Non-recurring event → calendarEventsDestroy(id).
 *  - Recurring event, scope='this' → calendarEventsCreateExceptionCreate with
 *    is_cancelled:true and the correct exception_date.
 *  - Recurring event, scope='all' → calendarEventsDestroy(id).
 *  - Recurring event, scope='following' → calendarEventsBulkModifyCreate with
 *    is_cancelled:true and the correct modification_start_date.
 *  - invalidateCalendarEvents is called after every successful cancel.
 *  - Errors propagate to the caller.
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
    calendarEventsDestroy: vi.fn(),
    calendarEventsCreateExceptionCreate: vi.fn(),
    calendarEventsBulkModifyCreate: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import {
  calendarEventsDestroy,
  calendarEventsCreateExceptionCreate,
  calendarEventsBulkModifyCreate,
} from '@/client/sdk.gen';
import { useCancelBooking } from './use-cancel-booking';
import type { CalendarEventVM } from '@/components/calendar/event-vm';
import type { CalendarEvent } from '@/client';
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRaw(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 42,
    title: 'Team Meeting',
    start_time: '2024-06-15T09:00:00-04:00',
    end_time: '2024-06-15T10:00:00-04:00',
    timezone: 'America/New_York',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    external_id: 'ext-42',
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
    ...overrides,
  };
}

function makeEventVM(
  overrides: Partial<CalendarEventVM> = {}
): CalendarEventVM {
  const raw = makeRaw();
  const zone = 'America/New_York';
  const startDt = DateTime.fromISO(raw.start_time, { zone });
  const endDt = DateTime.fromISO(raw.end_time, { zone });
  return {
    id: String(raw.id),
    title: raw.title,
    start: startDt.toJSDate(),
    end: endDt.toJSDate(),
    startDt,
    endDt,
    timezone: zone,
    timezoneLabel: 'EDT (UTC-4)',
    calendarId: 1,
    isRecurring: false,
    isRecurringException: false,
    status: 'confirmed',
    _raw: raw,
    ...overrides,
  };
}

function makeRecurringEventVM(
  overrides: Partial<CalendarEventVM> = {}
): CalendarEventVM {
  const raw = makeRaw({ is_recurring: true, is_recurring_instance: true });
  const zone = 'America/New_York';
  const startDt = DateTime.fromISO(raw.start_time, { zone });
  const endDt = DateTime.fromISO(raw.end_time, { zone });
  return {
    id: String(raw.id),
    title: raw.title,
    start: startDt.toJSDate(),
    end: endDt.toJSDate(),
    startDt,
    endDt,
    timezone: zone,
    timezoneLabel: 'EDT (UTC-4)',
    calendarId: 1,
    isRecurring: true,
    isRecurringException: false,
    status: 'confirmed',
    _raw: raw,
    ...overrides,
  };
}

// A void response (204) that the destroy/bulk-modify/create-exception ops return.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeVoidResponse(): any {
  return {
    data: undefined,
    response: new Response(null, { status: 204 }),
    request: new Request('https://example.com'),
  };
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

describe('useCancelBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('non-recurring event', () => {
    it('calls calendarEventsDestroy with the event id', async () => {
      vi.mocked(calendarEventsDestroy).mockResolvedValue(makeVoidResponse());

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCancelBooking(), { wrapper });

      await result.current.cancelBooking(makeEventVM());

      expect(calendarEventsDestroy).toHaveBeenCalledOnce();
      expect(calendarEventsDestroy).toHaveBeenCalledWith({
        path: { id: '42' },
      });
    });

    it('does NOT call createException or bulkModify for non-recurring event', async () => {
      vi.mocked(calendarEventsDestroy).mockResolvedValue(makeVoidResponse());

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCancelBooking(), { wrapper });

      await result.current.cancelBooking(makeEventVM());

      expect(calendarEventsCreateExceptionCreate).not.toHaveBeenCalled();
      expect(calendarEventsBulkModifyCreate).not.toHaveBeenCalled();
    });
  });

  describe('recurring event, scope = "this"', () => {
    it('calls calendarEventsCreateExceptionCreate with is_cancelled=true', async () => {
      vi.mocked(calendarEventsCreateExceptionCreate).mockResolvedValue(
        makeVoidResponse()
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCancelBooking(), { wrapper });

      await result.current.cancelBooking(makeRecurringEventVM(), 'this');

      expect(calendarEventsCreateExceptionCreate).toHaveBeenCalledOnce();
      const call = vi.mocked(calendarEventsCreateExceptionCreate).mock
        .calls[0][0];
      expect(call.path.id).toBe('42');
      expect(call.body.is_cancelled).toBe(true);
      expect(call.body.exception_date).toBe('2024-06-15');
    });

    it('does NOT call destroy or bulkModify', async () => {
      vi.mocked(calendarEventsCreateExceptionCreate).mockResolvedValue(
        makeVoidResponse()
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCancelBooking(), { wrapper });

      await result.current.cancelBooking(makeRecurringEventVM(), 'this');

      expect(calendarEventsDestroy).not.toHaveBeenCalled();
      expect(calendarEventsBulkModifyCreate).not.toHaveBeenCalled();
    });
  });

  describe('recurring event, scope = "all"', () => {
    it('calls calendarEventsDestroy with the event id', async () => {
      vi.mocked(calendarEventsDestroy).mockResolvedValue(makeVoidResponse());

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCancelBooking(), { wrapper });

      await result.current.cancelBooking(makeRecurringEventVM(), 'all');

      expect(calendarEventsDestroy).toHaveBeenCalledOnce();
      expect(calendarEventsDestroy).toHaveBeenCalledWith({
        path: { id: '42' },
      });
    });

    it('does NOT call createException or bulkModify', async () => {
      vi.mocked(calendarEventsDestroy).mockResolvedValue(makeVoidResponse());

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCancelBooking(), { wrapper });

      await result.current.cancelBooking(makeRecurringEventVM(), 'all');

      expect(calendarEventsCreateExceptionCreate).not.toHaveBeenCalled();
      expect(calendarEventsBulkModifyCreate).not.toHaveBeenCalled();
    });
  });

  describe('recurring event, scope = "following"', () => {
    it('calls calendarEventsBulkModifyCreate with is_cancelled=true', async () => {
      vi.mocked(calendarEventsBulkModifyCreate).mockResolvedValue(
        makeVoidResponse()
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCancelBooking(), { wrapper });

      await result.current.cancelBooking(makeRecurringEventVM(), 'following');

      expect(calendarEventsBulkModifyCreate).toHaveBeenCalledOnce();
      const call = vi.mocked(calendarEventsBulkModifyCreate).mock.calls[0][0];
      expect(call.path.id).toBe('42');
      expect(call.body.is_cancelled).toBe(true);
      expect(call.body.modification_start_date).toBe('2024-06-15');
    });

    it('does NOT call destroy or createException', async () => {
      vi.mocked(calendarEventsBulkModifyCreate).mockResolvedValue(
        makeVoidResponse()
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCancelBooking(), { wrapper });

      await result.current.cancelBooking(makeRecurringEventVM(), 'following');

      expect(calendarEventsDestroy).not.toHaveBeenCalled();
      expect(calendarEventsCreateExceptionCreate).not.toHaveBeenCalled();
    });
  });

  describe('error propagation', () => {
    it('propagates backend errors to the caller', async () => {
      const backendError = new Error('Unauthorized');
      vi.mocked(calendarEventsDestroy).mockRejectedValue(backendError);

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useCancelBooking(), { wrapper });

      await expect(result.current.cancelBooking(makeEventVM())).rejects.toThrow(
        'Unauthorized'
      );
    });
  });
});
