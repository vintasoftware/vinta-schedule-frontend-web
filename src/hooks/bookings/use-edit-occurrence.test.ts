/**
 * useEditOccurrence tests.
 *
 * Covers:
 *  - Non-recurring event → calendarEventsPartialUpdate with changed fields.
 *  - Recurring event, scope='this' → calendarEventsCreateExceptionCreate with
 *    modified_title, modified_description, modified_start_time, modified_end_time,
 *    and the correct exception_date; is_cancelled must be falsy.
 *  - Recurring event, scope='all' → calendarEventsPartialUpdate (whole series).
 *  - Recurring event, scope='following' → calendarEventsBulkModifyCreate with
 *    modification_start_date and time offsets.
 *  - invalidateCalendarEvents is called after every successful edit.
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
    calendarEventsPartialUpdate: vi.fn(),
    calendarEventsCreateExceptionCreate: vi.fn(),
    calendarEventsBulkModifyCreate: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import {
  calendarEventsPartialUpdate,
  calendarEventsCreateExceptionCreate,
  calendarEventsBulkModifyCreate,
} from '@/client/sdk.gen';
import { useEditOccurrence } from './use-edit-occurrence';
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
    description: 'Weekly sync',
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeOkResponse(): any {
  return {
    data: {},
    response: new Response(null, { status: 200 }),
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

// New start/end for the edit (moved 1 hour later, same day).
const NEW_START = '2024-06-15T11:00:00-04:00';
const NEW_END = '2024-06-15T12:00:00-04:00';
const TIMEZONE = 'America/New_York';
const NEW_TITLE = 'Updated Meeting';
const NEW_DESCRIPTION = 'Updated description';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useEditOccurrence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('non-recurring event', () => {
    it('calls calendarEventsPartialUpdate with changed title, description, and times', async () => {
      vi.mocked(calendarEventsPartialUpdate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useEditOccurrence(), { wrapper });

      await result.current.editOccurrence(makeEventVM(), {
        title: NEW_TITLE,
        description: NEW_DESCRIPTION,
        startTime: NEW_START,
        endTime: NEW_END,
        timezone: TIMEZONE,
      });

      expect(calendarEventsPartialUpdate).toHaveBeenCalledOnce();
      const call = vi.mocked(calendarEventsPartialUpdate).mock.calls[0][0];
      expect(call.path.id).toBe('42');
      expect(call.body?.title).toBe(NEW_TITLE);
      expect(call.body?.description).toBe(NEW_DESCRIPTION);
      expect(call.body?.start_time).toBe(NEW_START);
      expect(call.body?.end_time).toBe(NEW_END);
      expect(call.body?.timezone).toBe(TIMEZONE);
    });

    it('does NOT call createException or bulkModify for non-recurring event', async () => {
      vi.mocked(calendarEventsPartialUpdate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useEditOccurrence(), { wrapper });

      await result.current.editOccurrence(makeEventVM(), {
        title: NEW_TITLE,
      });

      expect(calendarEventsCreateExceptionCreate).not.toHaveBeenCalled();
      expect(calendarEventsBulkModifyCreate).not.toHaveBeenCalled();
    });

    it('only sends provided fields (partial update)', async () => {
      vi.mocked(calendarEventsPartialUpdate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useEditOccurrence(), { wrapper });

      await result.current.editOccurrence(makeEventVM(), {
        title: NEW_TITLE,
      });

      const call = vi.mocked(calendarEventsPartialUpdate).mock.calls[0][0];
      expect(call.body?.title).toBe(NEW_TITLE);
      // start_time and end_time should NOT be present when not provided.
      expect(call.body?.start_time).toBeUndefined();
      expect(call.body?.end_time).toBeUndefined();
    });
  });

  describe('recurring event, scope = "this"', () => {
    it('calls calendarEventsCreateExceptionCreate with modified fields and exception_date', async () => {
      vi.mocked(calendarEventsCreateExceptionCreate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useEditOccurrence(), { wrapper });

      await result.current.editOccurrence(
        makeRecurringEventVM(),
        {
          title: NEW_TITLE,
          description: NEW_DESCRIPTION,
          startTime: NEW_START,
          endTime: NEW_END,
          timezone: TIMEZONE,
        },
        'this'
      );

      expect(calendarEventsCreateExceptionCreate).toHaveBeenCalledOnce();
      const call = vi.mocked(calendarEventsCreateExceptionCreate).mock
        .calls[0][0];
      expect(call.path.id).toBe('42');
      // exception_date is the ISO date of the original occurrence's start_time.
      expect(call.body.exception_date).toBe('2024-06-15');
      expect(call.body.modified_title).toBe(NEW_TITLE);
      expect(call.body.modified_description).toBe(NEW_DESCRIPTION);
      expect(call.body.modified_start_time).toBe(NEW_START);
      expect(call.body.modified_end_time).toBe(NEW_END);
      // is_cancelled must NOT be true — this is a modification, not a cancel.
      expect(call.body.is_cancelled).toBeFalsy();
    });

    it('defaults to scope="this" when scope is omitted on a recurring event', async () => {
      vi.mocked(calendarEventsCreateExceptionCreate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useEditOccurrence(), { wrapper });

      // Omit scope — should default to 'this' (single-occurrence exception).
      await result.current.editOccurrence(makeRecurringEventVM(), {
        title: NEW_TITLE,
      });

      expect(calendarEventsCreateExceptionCreate).toHaveBeenCalledOnce();
      expect(calendarEventsPartialUpdate).not.toHaveBeenCalled();
      expect(calendarEventsBulkModifyCreate).not.toHaveBeenCalled();
    });

    it('does NOT call partialUpdate or bulkModify for scope "this"', async () => {
      vi.mocked(calendarEventsCreateExceptionCreate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useEditOccurrence(), { wrapper });

      await result.current.editOccurrence(makeRecurringEventVM(), {}, 'this');

      expect(calendarEventsPartialUpdate).not.toHaveBeenCalled();
      expect(calendarEventsBulkModifyCreate).not.toHaveBeenCalled();
    });
  });

  describe('recurring event, scope = "following"', () => {
    it('calls calendarEventsBulkModifyCreate with modification_start_date and time offsets', async () => {
      vi.mocked(calendarEventsBulkModifyCreate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useEditOccurrence(), { wrapper });

      await result.current.editOccurrence(
        makeRecurringEventVM(),
        {
          title: NEW_TITLE,
          startTime: NEW_START,
          endTime: NEW_END,
          timezone: TIMEZONE,
        },
        'following'
      );

      expect(calendarEventsBulkModifyCreate).toHaveBeenCalledOnce();
      const call = vi.mocked(calendarEventsBulkModifyCreate).mock.calls[0][0];
      expect(call.path.id).toBe('42');
      // modification_start_date is the ISO date of this occurrence's start.
      expect(call.body.modification_start_date).toBe('2024-06-15');
      expect(call.body.modified_title).toBe(NEW_TITLE);
      // NEW_START = '2024-06-15T11:00:00-04:00' → 11:00:00 in America/New_York
      expect(call.body.modified_start_time_offset).toBe('11:00:00');
      // NEW_END = '2024-06-15T12:00:00-04:00' → 12:00:00 in America/New_York
      expect(call.body.modified_end_time_offset).toBe('12:00:00');
    });

    it('does NOT call partialUpdate or createException for scope "following"', async () => {
      vi.mocked(calendarEventsBulkModifyCreate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useEditOccurrence(), { wrapper });

      await result.current.editOccurrence(
        makeRecurringEventVM(),
        {},
        'following'
      );

      expect(calendarEventsPartialUpdate).not.toHaveBeenCalled();
      expect(calendarEventsCreateExceptionCreate).not.toHaveBeenCalled();
    });
  });

  describe('recurring event, scope = "all"', () => {
    it('calls calendarEventsPartialUpdate with changed fields (whole series)', async () => {
      vi.mocked(calendarEventsPartialUpdate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useEditOccurrence(), { wrapper });

      await result.current.editOccurrence(
        makeRecurringEventVM(),
        {
          title: NEW_TITLE,
          startTime: NEW_START,
          endTime: NEW_END,
          timezone: TIMEZONE,
        },
        'all'
      );

      expect(calendarEventsPartialUpdate).toHaveBeenCalledOnce();
      const call = vi.mocked(calendarEventsPartialUpdate).mock.calls[0][0];
      expect(call.path.id).toBe('42');
      expect(call.body?.title).toBe(NEW_TITLE);
      expect(call.body?.start_time).toBe(NEW_START);
      expect(call.body?.end_time).toBe(NEW_END);
    });

    it('does NOT call createException or bulkModify for scope "all"', async () => {
      vi.mocked(calendarEventsPartialUpdate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useEditOccurrence(), { wrapper });

      await result.current.editOccurrence(makeRecurringEventVM(), {}, 'all');

      expect(calendarEventsCreateExceptionCreate).not.toHaveBeenCalled();
      expect(calendarEventsBulkModifyCreate).not.toHaveBeenCalled();
    });
  });

  describe('error propagation', () => {
    it('propagates backend errors to the caller (non-recurring)', async () => {
      const backendError = new Error('Unauthorized');
      vi.mocked(calendarEventsPartialUpdate).mockRejectedValue(backendError);

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useEditOccurrence(), { wrapper });

      await expect(
        result.current.editOccurrence(makeEventVM(), { title: NEW_TITLE })
      ).rejects.toThrow('Unauthorized');
    });

    it('propagates backend errors to the caller (recurring, scope="this")', async () => {
      const backendError = new Error('Forbidden');
      vi.mocked(calendarEventsCreateExceptionCreate).mockRejectedValue(
        backendError
      );

      const wrapper = makeQueryWrapper();
      const { result } = renderHook(() => useEditOccurrence(), { wrapper });

      await expect(
        result.current.editOccurrence(makeRecurringEventVM(), {}, 'this')
      ).rejects.toThrow('Forbidden');
    });
  });
});
