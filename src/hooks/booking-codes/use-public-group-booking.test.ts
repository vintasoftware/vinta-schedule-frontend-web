/**
 * use-public-group-booking.ts tests.
 *
 * Covers:
 * - `usePublicGroupBookableSlots` sends `X-Booking-Code` through the public
 *   client and maps an opaque 403 to `PublicReadFailureError('link-invalid')`.
 * - `fetchPublicGroupSlotAvailability` sends the single range and code, and
 *   maps a 403 to the same opaque read failure (never a write failure).
 * - `usePublicGroupBookEvent` sends the code + a fixed, meaningless
 *   `public_slug` path placeholder, resolves with the created event, and
 *   maps the write error vocabulary (`SLOT_UNAVAILABLE` retryable, others
 *   not) via `PublicWriteFailureError`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    publicBookingCalendarGroupBookableSlotsList: vi.fn(),
    publicBookingCalendarGroupAvailabilityCreate: vi.fn(),
    publicBookingCalendarGroupsEventsCreate: vi.fn(),
  };
});

import {
  publicBookingCalendarGroupBookableSlotsList,
  publicBookingCalendarGroupAvailabilityCreate,
  publicBookingCalendarGroupsEventsCreate,
} from '@/client/sdk.gen';
import type {
  BookingCodeGroupEventCreate,
  CalendarEvent,
  CalendarGroupRangeAvailability,
} from '@/client';
import {
  PublicReadFailureError,
  PublicWriteFailureError,
} from '@/lib/booking-links/errors';
import {
  usePublicGroupBookableSlots,
  fetchPublicGroupSlotAvailability,
  usePublicGroupBookEvent,
} from './use-public-group-booking';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 1,
    title: 'Appointment',
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

const groupEventBody: BookingCodeGroupEventCreate = {
  title: 'Appointment',
  start_time: '2026-01-01T10:00:00Z',
  end_time: '2026-01-01T10:30:00Z',
  timezone: 'UTC',
  slot_selections: [{ slot_id: 1, calendar_ids: [10] }],
  external_attendee: { email: 'attendee@example.com' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePublicGroupBookableSlots', () => {
  it('sends the code as X-Booking-Code through the public client', async () => {
    const proposals = [
      { start_time: '2026-01-01T10:00:00Z', end_time: '2026-01-01T10:30:00Z' },
    ];
    vi.mocked(
      publicBookingCalendarGroupBookableSlotsList
    ).mockResolvedValueOnce({
      data: proposals,
      response: new Response(JSON.stringify(proposals), { status: 200 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarGroupBookableSlotsList>
    >);

    const Wrapper = createWrapper();
    const { result } = renderHook(
      () =>
        usePublicGroupBookableSlots({
          code: 'secret-code',
          durationSeconds: 1800,
          searchWindowStart: '2026-01-01T00:00:00Z',
          searchWindowEnd: '2026-01-02T00:00:00Z',
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(proposals);
    expect(
      vi.mocked(publicBookingCalendarGroupBookableSlotsList)
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Booking-Code': 'secret-code' },
      })
    );
  });

  it('maps an opaque 403 read failure to PublicReadFailureError with state link-invalid', async () => {
    vi.mocked(
      publicBookingCalendarGroupBookableSlotsList
    ).mockResolvedValueOnce({
      data: undefined,
      error: { detail: 'Invalid or expired code.' },
      response: new Response(
        JSON.stringify({ detail: 'Invalid or expired code.' }),
        { status: 403 }
      ),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarGroupBookableSlotsList>
    >);

    const Wrapper = createWrapper();
    const { result } = renderHook(
      () =>
        usePublicGroupBookableSlots({
          code: 'revoked-code',
          durationSeconds: 1800,
          searchWindowStart: '2026-01-01T00:00:00Z',
          searchWindowEnd: '2026-01-02T00:00:00Z',
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(PublicReadFailureError);
    expect((result.current.error as PublicReadFailureError).state).toBe(
      'link-invalid'
    );
  });

  it('does not fire when disabled', () => {
    renderHook(
      () =>
        usePublicGroupBookableSlots({
          code: 'secret-code',
          durationSeconds: 1800,
          searchWindowStart: '2026-01-01T00:00:00Z',
          searchWindowEnd: '2026-01-02T00:00:00Z',
          enabled: false,
        }),
      { wrapper: createWrapper() }
    );
    expect(
      vi.mocked(publicBookingCalendarGroupBookableSlotsList)
    ).not.toHaveBeenCalled();
  });
});

describe('fetchPublicGroupSlotAvailability', () => {
  it('sends the single queried range and code, and returns the matching range', async () => {
    const range: CalendarGroupRangeAvailability = {
      start_time: '2026-01-01T10:00:00Z',
      end_time: '2026-01-01T10:30:00Z',
      slots: [
        {
          slot_id: 1,
          available_calendar_ids: [10, 11],
          required_count: 1,
          is_bookable: true,
        },
      ],
    };
    vi.mocked(
      publicBookingCalendarGroupAvailabilityCreate
    ).mockResolvedValueOnce({
      data: { count: 1, results: [range] },
      response: new Response(JSON.stringify({ count: 1, results: [range] }), {
        status: 200,
      }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarGroupAvailabilityCreate>
    >);

    const result = await fetchPublicGroupSlotAvailability({
      code: 'secret-code',
      startTime: range.start_time,
      endTime: range.end_time,
    });

    expect(result).toEqual(range);
    expect(
      vi.mocked(publicBookingCalendarGroupAvailabilityCreate)
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Booking-Code': 'secret-code' },
        body: {
          ranges: [{ start_time: range.start_time, end_time: range.end_time }],
        },
      })
    );
  });

  it('maps an opaque 403 to PublicReadFailureError, never a write failure', async () => {
    vi.mocked(
      publicBookingCalendarGroupAvailabilityCreate
    ).mockResolvedValueOnce({
      data: undefined,
      error: { detail: 'Invalid or expired code.' },
      response: new Response(
        JSON.stringify({ detail: 'Invalid or expired code.' }),
        { status: 403 }
      ),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarGroupAvailabilityCreate>
    >);

    await expect(
      fetchPublicGroupSlotAvailability({
        code: 'revoked-code',
        startTime: '2026-01-01T10:00:00Z',
        endTime: '2026-01-01T10:30:00Z',
      })
    ).rejects.toBeInstanceOf(PublicReadFailureError);
  });
});

describe('usePublicGroupBookEvent', () => {
  it('resolves with the created event, sending the code and a fixed public_slug placeholder', async () => {
    const event = makeEvent();
    vi.mocked(publicBookingCalendarGroupsEventsCreate).mockResolvedValueOnce({
      data: event,
      response: new Response(JSON.stringify(event), { status: 201 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarGroupsEventsCreate>
    >);

    const Wrapper = createWrapper();
    const { result } = renderHook(() => usePublicGroupBookEvent(), {
      wrapper: Wrapper,
    });

    let resolved: CalendarEvent | undefined;
    await act(async () => {
      resolved = await result.current.bookGroupEvent({
        code: 'secret-code',
        body: groupEventBody,
      });
    });

    expect(resolved).toEqual(event);
    expect(
      vi.mocked(publicBookingCalendarGroupsEventsCreate)
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Booking-Code': 'secret-code' },
        body: groupEventBody,
        path: { public_slug: expect.any(String) },
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
      vi.mocked(publicBookingCalendarGroupsEventsCreate).mockResolvedValueOnce({
        data: undefined,
        error: responseBody,
        response: new Response(JSON.stringify(responseBody), { status }),
      } as unknown as Awaited<
        ReturnType<typeof publicBookingCalendarGroupsEventsCreate>
      >);

      const Wrapper = createWrapper();
      const { result } = renderHook(() => usePublicGroupBookEvent(), {
        wrapper: Wrapper,
      });

      let caught: unknown;
      await act(async () => {
        try {
          await result.current.bookGroupEvent({
            code: 'secret-code',
            body: groupEventBody,
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
});
