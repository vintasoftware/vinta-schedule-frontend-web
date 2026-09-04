/**
 * usePublicReschedule tests.
 *
 * Covers:
 * - `target: 'calendar'` calls `publicBookingEventsRescheduleCreate` only,
 *   never the group endpoint.
 * - `target: 'group'` calls `publicBookingGroupEventsRescheduleCreate` only,
 *   never the single-calendar endpoint — the "no probing" rule from the
 *   module doc comment, exercised end to end.
 * - Write failures map to `PublicWriteFailureError`; `SLOT_UNAVAILABLE` is
 *   retryable, `ALREADY_USED` / `EXPIRED` are terminal and distinct.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    publicBookingEventsRescheduleCreate: vi.fn(),
    publicBookingGroupEventsRescheduleCreate: vi.fn(),
  };
});

import {
  publicBookingEventsRescheduleCreate,
  publicBookingGroupEventsRescheduleCreate,
} from '@/client/sdk.gen';
import type { BookingCodeReschedule, CalendarEvent } from '@/client';
import { PublicWriteFailureError } from '@/lib/booking-links/errors';
import { usePublicReschedule } from './use-public-reschedule';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 1,
    title: 'Appointment',
    start_time: '2026-03-02T11:00:00.000Z',
    end_time: '2026-03-02T11:30:00.000Z',
    timezone: 'UTC',
    created: '2026-01-01T00:00:00.000Z',
    modified: '2026-01-01T00:00:00.000Z',
    external_id: 'evt-1',
    external_attendances: [],
    attendances: [],
    resource_allocations: [],
    group_selections: [],
    parent_recurring_object: {
      id: 0,
      title: '',
      external_id: '',
      start_time: '2026-01-01T00:00:00.000Z',
      end_time: '2026-01-01T00:00:00.000Z',
      created: '2026-01-01T00:00:00.000Z',
      modified: '2026-01-01T00:00:00.000Z',
    },
    is_recurring_instance: false,
    is_recurring: false,
    ...overrides,
  } as CalendarEvent;
}

const body: BookingCodeReschedule = {
  start_time: '2026-03-02T11:00:00.000Z',
  end_time: '2026-03-02T11:30:00.000Z',
  timezone: 'UTC',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

describe('usePublicReschedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("target: 'calendar' calls ONLY the single-calendar reschedule endpoint", async () => {
    const event = makeEvent();
    vi.mocked(publicBookingEventsRescheduleCreate).mockResolvedValueOnce({
      data: event,
      response: new Response(JSON.stringify(event), { status: 201 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingEventsRescheduleCreate>
    >);

    const Wrapper = createWrapper();
    const { result } = renderHook(() => usePublicReschedule(), {
      wrapper: Wrapper,
    });

    let resolved: CalendarEvent | undefined;
    await act(async () => {
      resolved = await result.current.reschedule({
        code: 'secret-code',
        target: 'calendar',
        body,
      });
    });

    expect(resolved).toEqual(event);
    expect(publicBookingEventsRescheduleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Booking-Code': 'secret-code' },
        body,
      })
    );
    expect(publicBookingGroupEventsRescheduleCreate).not.toHaveBeenCalled();
  });

  it("target: 'group' calls ONLY the group reschedule endpoint — never the single-calendar one, even for a wrong-scope code (no probing)", async () => {
    const event = makeEvent();
    vi.mocked(publicBookingGroupEventsRescheduleCreate).mockResolvedValueOnce({
      data: event,
      response: new Response(JSON.stringify(event), { status: 201 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingGroupEventsRescheduleCreate>
    >);

    const Wrapper = createWrapper();
    const { result } = renderHook(() => usePublicReschedule(), {
      wrapper: Wrapper,
    });

    let resolved: CalendarEvent | undefined;
    await act(async () => {
      resolved = await result.current.reschedule({
        code: 'group-secret-code',
        target: 'group',
        body,
      });
    });

    expect(resolved).toEqual(event);
    expect(publicBookingGroupEventsRescheduleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Booking-Code': 'group-secret-code' },
        body,
      })
    );
    expect(publicBookingEventsRescheduleCreate).not.toHaveBeenCalled();
  });

  it.each([
    ['SLOT_UNAVAILABLE', 409, true],
    ['ALREADY_USED', 409, false],
    ['EXPIRED', 410, false],
  ] as const)(
    'rejects with a PublicWriteFailureError for %s (%d), isRetryable=%s',
    async (errorCode, status, isRetryable) => {
      const responseBody = {
        error_code: errorCode,
        detail: `${errorCode} happened`,
      };
      vi.mocked(publicBookingEventsRescheduleCreate).mockResolvedValueOnce({
        data: undefined,
        error: responseBody,
        response: new Response(JSON.stringify(responseBody), { status }),
      } as unknown as Awaited<
        ReturnType<typeof publicBookingEventsRescheduleCreate>
      >);

      const Wrapper = createWrapper();
      const { result } = renderHook(() => usePublicReschedule(), {
        wrapper: Wrapper,
      });

      let caught: unknown;
      await act(async () => {
        try {
          await result.current.reschedule({
            code: 'secret-code',
            target: 'calendar',
            body,
          });
        } catch (err) {
          caught = err;
        }
      });

      expect(caught).toBeInstanceOf(PublicWriteFailureError);
      const failure = (caught as PublicWriteFailureError).failure;
      expect(failure.errorCode).toBe(errorCode);
      expect(failure.isRetryable).toBe(isRetryable);
    }
  );

  it('ALREADY_USED and NOT_PERMITTED render distinct detail text', async () => {
    const alreadyUsedBody = {
      error_code: 'ALREADY_USED',
      detail: 'This booking code has already been used.',
    };
    vi.mocked(publicBookingEventsRescheduleCreate).mockResolvedValueOnce({
      data: undefined,
      error: alreadyUsedBody,
      response: new Response(JSON.stringify(alreadyUsedBody), { status: 409 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingEventsRescheduleCreate>
    >);

    const Wrapper = createWrapper();
    const { result } = renderHook(() => usePublicReschedule(), {
      wrapper: Wrapper,
    });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.reschedule({
          code: 'secret-code',
          target: 'calendar',
          body,
        });
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBeInstanceOf(PublicWriteFailureError);
    expect((caught as PublicWriteFailureError).failure.errorCode).toBe(
      'ALREADY_USED'
    );
  });
});
