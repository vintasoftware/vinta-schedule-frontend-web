/**
 * use-codeless-group-booking.ts tests.
 *
 * Covers:
 * - `useCodelessGroupBookableSlots` addresses the group by `public_slug` in
 *   the PATH, sends no `X-Booking-Code` header and no `duration_seconds`
 *   query param, and maps a 404 to `'not-found'` and a 403 to `'unavailable'`
 *   — two DISTINCT states (never collapsed the way the coded read is).
 * - `fetchCodelessGroupSlotAvailability` sends the single range against the
 *   slug-addressed path with no code header, and maps failures the same way.
 * - `useCodelessGroupBookEvent` sends the group's `public_slug` and NO
 *   `headers` option at all (its absence is what selects the codeless
 *   branch), resolves with the created event, and maps the write error
 *   vocabulary via `PublicWriteFailureError` (unchanged from the coded path).
 * - All three operations are called with `client: publicBookingClient`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { publicBookingClient } from '@/lib/booking-links/public-client';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    publicBookingCalendarGroupsBookableSlotsList: vi.fn(),
    publicBookingCalendarGroupsAvailabilityCreate: vi.fn(),
    publicBookingCalendarGroupsEventsCreate: vi.fn(),
  };
});

import {
  publicBookingCalendarGroupsBookableSlotsList,
  publicBookingCalendarGroupsAvailabilityCreate,
  publicBookingCalendarGroupsEventsCreate,
} from '@/client/sdk.gen';
import type {
  BookingCodeGroupEventCreate,
  CalendarEvent,
  CalendarGroupRangeAvailability,
} from '@/client';
import { CodelessGroupReadFailureError } from '@/lib/booking-links/codeless-group-read-errors';
import { PublicWriteFailureError } from '@/lib/booking-links/errors';
import {
  useCodelessGroupBookableSlots,
  fetchCodelessGroupSlotAvailability,
  useCodelessGroupBookEvent,
} from './use-codeless-group-booking';

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

describe('useCodelessGroupBookableSlots', () => {
  it('addresses the group by public_slug in the path, with no X-Booking-Code header and no duration_seconds param', async () => {
    const proposals = [
      { start_time: '2026-01-01T10:00:00Z', end_time: '2026-01-01T10:30:00Z' },
    ];
    vi.mocked(
      publicBookingCalendarGroupsBookableSlotsList
    ).mockResolvedValueOnce({
      data: proposals,
      response: new Response(JSON.stringify(proposals), { status: 200 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarGroupsBookableSlotsList>
    >);

    const Wrapper = createWrapper();
    const { result } = renderHook(
      () =>
        useCodelessGroupBookableSlots({
          publicSlug: 'surgery-team',
          searchWindowStart: '2026-01-01T00:00:00Z',
          searchWindowEnd: '2026-01-02T00:00:00Z',
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(proposals);

    const call = vi.mocked(publicBookingCalendarGroupsBookableSlotsList).mock
      .calls[0][0];
    expect(call.client).toBe(publicBookingClient);
    expect(call.path).toEqual({ public_slug: 'surgery-team' });
    expect(call.headers).toBeUndefined();
    expect(call.query).not.toHaveProperty('duration_seconds');
  });

  it('maps a 404 (unknown slug) to CodelessGroupReadFailureError with state not-found', async () => {
    vi.mocked(
      publicBookingCalendarGroupsBookableSlotsList
    ).mockResolvedValueOnce({
      data: undefined,
      error: { detail: 'Not found.' },
      response: new Response(JSON.stringify({ detail: 'Not found.' }), {
        status: 404,
      }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarGroupsBookableSlotsList>
    >);

    const { result } = renderHook(
      () =>
        useCodelessGroupBookableSlots({
          publicSlug: 'no-such-group',
          searchWindowStart: '2026-01-01T00:00:00Z',
          searchWindowEnd: '2026-01-02T00:00:00Z',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(CodelessGroupReadFailureError);
    expect((result.current.error as CodelessGroupReadFailureError).state).toBe(
      'not-found'
    );
  });

  it('maps a 403 (real but non-public group) to CodelessGroupReadFailureError with state unavailable — distinct from not-found', async () => {
    vi.mocked(
      publicBookingCalendarGroupsBookableSlotsList
    ).mockResolvedValueOnce({
      data: undefined,
      error: { detail: 'This group is not publicly bookable.' },
      response: new Response(
        JSON.stringify({ detail: 'This group is not publicly bookable.' }),
        { status: 403 }
      ),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarGroupsBookableSlotsList>
    >);

    const { result } = renderHook(
      () =>
        useCodelessGroupBookableSlots({
          publicSlug: 'private-group',
          searchWindowStart: '2026-01-01T00:00:00Z',
          searchWindowEnd: '2026-01-02T00:00:00Z',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(CodelessGroupReadFailureError);
    expect((result.current.error as CodelessGroupReadFailureError).state).toBe(
      'unavailable'
    );
  });

  it('does not fire when disabled', () => {
    renderHook(
      () =>
        useCodelessGroupBookableSlots({
          publicSlug: 'surgery-team',
          searchWindowStart: '2026-01-01T00:00:00Z',
          searchWindowEnd: '2026-01-02T00:00:00Z',
          enabled: false,
        }),
      { wrapper: createWrapper() }
    );
    expect(
      vi.mocked(publicBookingCalendarGroupsBookableSlotsList)
    ).not.toHaveBeenCalled();
  });
});

describe('fetchCodelessGroupSlotAvailability', () => {
  it('sends the single queried range against the slug-addressed path with no code header', async () => {
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
      publicBookingCalendarGroupsAvailabilityCreate
    ).mockResolvedValueOnce({
      data: { count: 1, results: [range] },
      response: new Response(JSON.stringify({ count: 1, results: [range] }), {
        status: 200,
      }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarGroupsAvailabilityCreate>
    >);

    const result = await fetchCodelessGroupSlotAvailability({
      publicSlug: 'surgery-team',
      startTime: range.start_time,
      endTime: range.end_time,
    });

    expect(result).toEqual(range);
    const call = vi.mocked(publicBookingCalendarGroupsAvailabilityCreate).mock
      .calls[0][0];
    expect(call.client).toBe(publicBookingClient);
    expect(call.path).toEqual({ public_slug: 'surgery-team' });
    expect(call.headers).toBeUndefined();
    expect(call.body).toEqual({
      ranges: [{ start_time: range.start_time, end_time: range.end_time }],
    });
  });

  it('maps a 404 to not-found and a 403 to unavailable, never a write failure', async () => {
    vi.mocked(publicBookingCalendarGroupsAvailabilityCreate)
      .mockResolvedValueOnce({
        data: undefined,
        error: { detail: 'Not found.' },
        response: new Response(JSON.stringify({ detail: 'Not found.' }), {
          status: 404,
        }),
      } as unknown as Awaited<
        ReturnType<typeof publicBookingCalendarGroupsAvailabilityCreate>
      >)
      .mockResolvedValueOnce({
        data: undefined,
        error: { detail: 'Not publicly bookable.' },
        response: new Response(
          JSON.stringify({ detail: 'Not publicly bookable.' }),
          { status: 403 }
        ),
      } as unknown as Awaited<
        ReturnType<typeof publicBookingCalendarGroupsAvailabilityCreate>
      >);

    const notFoundError = await fetchCodelessGroupSlotAvailability({
      publicSlug: 'no-such-group',
      startTime: '2026-01-01T10:00:00Z',
      endTime: '2026-01-01T10:30:00Z',
    }).catch((err: unknown) => err);
    expect(notFoundError).toBeInstanceOf(CodelessGroupReadFailureError);
    expect((notFoundError as CodelessGroupReadFailureError).state).toBe(
      'not-found'
    );

    const unavailableError = await fetchCodelessGroupSlotAvailability({
      publicSlug: 'private-group',
      startTime: '2026-01-01T10:00:00Z',
      endTime: '2026-01-01T10:30:00Z',
    }).catch((err: unknown) => err);
    expect(unavailableError).toBeInstanceOf(CodelessGroupReadFailureError);
    expect((unavailableError as CodelessGroupReadFailureError).state).toBe(
      'unavailable'
    );
  });
});

describe('useCodelessGroupBookEvent', () => {
  it('resolves with the created event, sending the group public_slug and NO headers option at all', async () => {
    const event = makeEvent();
    vi.mocked(publicBookingCalendarGroupsEventsCreate).mockResolvedValueOnce({
      data: event,
      response: new Response(JSON.stringify(event), { status: 201 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarGroupsEventsCreate>
    >);

    const Wrapper = createWrapper();
    const { result } = renderHook(() => useCodelessGroupBookEvent(), {
      wrapper: Wrapper,
    });

    let resolved: CalendarEvent | undefined;
    await act(async () => {
      resolved = await result.current.bookGroupEvent({
        publicSlug: 'surgery-team',
        body: groupEventBody,
      });
    });

    expect(resolved).toEqual(event);
    const call = vi.mocked(publicBookingCalendarGroupsEventsCreate).mock
      .calls[0][0];
    expect(call.client).toBe(publicBookingClient);
    expect(call.path).toEqual({ public_slug: 'surgery-team' });
    expect(call.body).toEqual(groupEventBody);
    // The load-bearing assertion: no `headers` key at all, so no
    // `X-Booking-Code` can be sent — its absence selects the codeless
    // branch server-side.
    expect(call.headers).toBeUndefined();
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
      const { result } = renderHook(() => useCodelessGroupBookEvent(), {
        wrapper: Wrapper,
      });

      let caught: unknown;
      await act(async () => {
        try {
          await result.current.bookGroupEvent({
            publicSlug: 'surgery-team',
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

  it('books successfully a second time through the same slug — a codeless link is reusable, unlike a code', async () => {
    const firstEvent = makeEvent({ id: 1 });
    const secondEvent = makeEvent({ id: 2 });
    vi.mocked(publicBookingCalendarGroupsEventsCreate)
      .mockResolvedValueOnce({
        data: firstEvent,
        response: new Response(JSON.stringify(firstEvent), { status: 201 }),
      } as unknown as Awaited<
        ReturnType<typeof publicBookingCalendarGroupsEventsCreate>
      >)
      .mockResolvedValueOnce({
        data: secondEvent,
        response: new Response(JSON.stringify(secondEvent), { status: 201 }),
      } as unknown as Awaited<
        ReturnType<typeof publicBookingCalendarGroupsEventsCreate>
      >);

    const Wrapper = createWrapper();
    const { result } = renderHook(() => useCodelessGroupBookEvent(), {
      wrapper: Wrapper,
    });

    let first: CalendarEvent | undefined;
    let second: CalendarEvent | undefined;
    await act(async () => {
      first = await result.current.bookGroupEvent({
        publicSlug: 'surgery-team',
        body: groupEventBody,
      });
    });
    await act(async () => {
      second = await result.current.bookGroupEvent({
        publicSlug: 'surgery-team',
        body: groupEventBody,
      });
    });

    expect(first).toEqual(firstEvent);
    expect(second).toEqual(secondEvent);
    expect(
      vi.mocked(publicBookingCalendarGroupsEventsCreate)
    ).toHaveBeenCalledTimes(2);
  });
});
