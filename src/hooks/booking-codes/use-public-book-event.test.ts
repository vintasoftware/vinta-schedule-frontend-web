/**
 * usePublicBookEvent tests.
 *
 * Covers:
 * - A successful book call resolves with the created `CalendarEvent` and
 *   sends the code as `X-Booking-Code` through the public client.
 * - Every write failure maps to a `PublicWriteFailureError` carrying the
 *   parsed `PublicWriteFailure`; `SLOT_UNAVAILABLE` is the only retryable
 *   one, `ALREADY_USED` / `EXPIRED` are terminal and distinct from each
 *   other (via `.failure.errorCode`).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    publicBookingCalendarEventsCreate: vi.fn(),
  };
});

import { publicBookingCalendarEventsCreate } from '@/client/sdk.gen';
import type { BookingCodeEventCreate, CalendarEvent } from '@/client';
import { PublicWriteFailureError } from '@/lib/booking-links/errors';
import { usePublicBookEvent } from './use-public-book-event';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 1,
    title: 'Consultation',
    start_time: '2026-01-01T10:00:00Z',
    end_time: '2026-01-01T10:30:00Z',
    timezone: 'UTC',
    created: '2026-01-01T00:00:00Z',
    modified: '2026-01-01T00:00:00Z',
    external_id: 'evt-1',
    external_attendances: [],
    attendances: [],
    resource_allocations: [],
    group_selections: [],
    parent_recurring_object: {
      id: 0,
      title: '',
      external_id: '',
      start_time: '2026-01-01T00:00:00Z',
      end_time: '2026-01-01T00:00:00Z',
      created: '2026-01-01T00:00:00Z',
      modified: '2026-01-01T00:00:00Z',
    },
    is_recurring_instance: false,
    is_recurring: false,
    ...overrides,
  } as CalendarEvent;
}

const body: BookingCodeEventCreate = {
  title: 'Consultation',
  start_time: '2026-01-01T10:00:00Z',
  end_time: '2026-01-01T10:30:00Z',
  timezone: 'UTC',
  external_attendee: { email: 'attendee@example.com' },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

describe('usePublicBookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves with the created event and sends the code as X-Booking-Code', async () => {
    const event = makeEvent();
    vi.mocked(publicBookingCalendarEventsCreate).mockResolvedValueOnce({
      data: event,
      response: new Response(JSON.stringify(event), { status: 201 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarEventsCreate>
    >);

    const Wrapper = createWrapper();
    const { result } = renderHook(() => usePublicBookEvent(), {
      wrapper: Wrapper,
    });

    let resolved: CalendarEvent | undefined;
    await act(async () => {
      resolved = await result.current.bookEvent({ code: 'secret-code', body });
    });

    expect(resolved).toEqual(event);
    expect(vi.mocked(publicBookingCalendarEventsCreate)).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Booking-Code': 'secret-code' },
        body,
      })
    );
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
      vi.mocked(publicBookingCalendarEventsCreate).mockResolvedValueOnce({
        data: undefined,
        error: responseBody,
        response: new Response(JSON.stringify(responseBody), { status }),
      } as unknown as Awaited<
        ReturnType<typeof publicBookingCalendarEventsCreate>
      >);

      const Wrapper = createWrapper();
      const { result } = renderHook(() => usePublicBookEvent(), {
        wrapper: Wrapper,
      });

      let caught: unknown;
      await act(async () => {
        try {
          await result.current.bookEvent({ code: 'secret-code', body });
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

  it('ALREADY_USED and EXPIRED are distinct failures', async () => {
    const alreadyUsedBody = {
      error_code: 'ALREADY_USED',
      detail: 'This booking code has already been used.',
    };
    vi.mocked(publicBookingCalendarEventsCreate).mockResolvedValueOnce({
      data: undefined,
      error: alreadyUsedBody,
      response: new Response(JSON.stringify(alreadyUsedBody), { status: 409 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarEventsCreate>
    >);

    const expiredBody = {
      error_code: 'EXPIRED',
      detail: 'This booking code has expired.',
    };
    vi.mocked(publicBookingCalendarEventsCreate).mockResolvedValueOnce({
      data: undefined,
      error: expiredBody,
      response: new Response(JSON.stringify(expiredBody), { status: 410 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarEventsCreate>
    >);

    const Wrapper = createWrapper();
    const { result: resultA } = renderHook(() => usePublicBookEvent(), {
      wrapper: Wrapper,
    });
    const { result: resultB } = renderHook(() => usePublicBookEvent(), {
      wrapper: Wrapper,
    });

    let caughtA: unknown;
    await act(async () => {
      try {
        await resultA.current.bookEvent({ code: 'secret-code', body });
      } catch (err) {
        caughtA = err;
      }
    });
    let caughtB: unknown;
    await act(async () => {
      try {
        await resultB.current.bookEvent({ code: 'secret-code', body });
      } catch (err) {
        caughtB = err;
      }
    });

    const failureA = (caughtA as PublicWriteFailureError).failure;
    const failureB = (caughtB as PublicWriteFailureError).failure;
    expect(failureA.errorCode).toBe('ALREADY_USED');
    expect(failureB.errorCode).toBe('EXPIRED');
    expect(failureA.detail).not.toBe(failureB.detail);
  });
});
