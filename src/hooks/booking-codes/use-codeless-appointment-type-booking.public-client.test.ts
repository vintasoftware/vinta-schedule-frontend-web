/**
 * useCodelessAppointmentTypeBookableSlots — dedicated public-client regression test.
 *
 * Same rationale as `use-public-appointment-type-booking.public-client.test.ts`: the
 * module-mocked test file proves the CALL SITE passes the right options, but
 * never exercises `publicBookingClient` itself. This file, kept separate so
 * it does NOT mock `@/client/sdk.gen`, seeds `localStorage` with a token and
 * an active organization (as if a logged-in member were browsing a public
 * appointment type link), points `publicBookingClient` at a mock `fetch`, and asserts
 * the OUTGOING REQUEST carries neither `X-Booking-Code`, `Authorization`,
 * nor `X-Organization-Id`.
 *
 * The absent `X-Booking-Code` is the load-bearing assertion for this whole
 * phase — the header's absence is what selects the codeless branch
 * server-side (see `use-codeless-appointment-type-booking.ts`'s doc comment). A
 * regression that accidentally attached a code header here would silently
 * route every "codeless" booking onto the coded branch instead.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { publicBookingClient } from '@/lib/booking-links/public-client';
import { useCodelessAppointmentTypeBookableSlots } from './use-codeless-appointment-type-booking';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

describe('useCodelessAppointmentTypeBookableSlots (real publicBookingClient)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sends no X-Booking-Code, Authorization, or X-Organization-Id, even with a token and active org in localStorage', async () => {
    // Simulate a logged-in visitor browsing a public appointment type's reusable link.
    localStorage.setItem('accessToken', 'a-real-jwt-token');
    localStorage.setItem('activeOrganizationId', 'org-42');

    const mockFetch = vi.fn(
      async (_req: Request) =>
        new Response(
          JSON.stringify([
            {
              start_time: '2026-01-01T10:00:00Z',
              end_time: '2026-01-01T10:30:00Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );
    publicBookingClient.setConfig({
      fetch: mockFetch as unknown as typeof fetch,
      baseUrl: 'http://test.local',
    });

    const Wrapper = createWrapper();
    const { result } = renderHook(
      () =>
        useCodelessAppointmentTypeBookableSlots({
          publicSlug: 'surgery-team',
          searchWindowStart: '2026-01-01T00:00:00Z',
          searchWindowEnd: '2026-01-02T00:00:00Z',
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledOnce();
    const outgoingRequest: Request = mockFetch.mock.calls[0][0];
    expect(outgoingRequest.url).toContain(
      '/public/booking/appointment-types/surgery-team/bookable-slots/'
    );
    expect(outgoingRequest.headers.has('X-Booking-Code')).toBe(false);
    expect(outgoingRequest.headers.has('Authorization')).toBe(false);
    expect(outgoingRequest.headers.has('X-Organization-Id')).toBe(false);
    expect(result.current.data).toEqual([
      { start_time: '2026-01-01T10:00:00Z', end_time: '2026-01-01T10:30:00Z' },
    ]);
  });
});
