/**
 * usePublicAppointmentTypeBookableSlots — dedicated public-client regression test.
 *
 * `use-public-appointment-type-booking.test.ts` mocks `@/client/sdk.gen` at the module
 * level for every test in that file, so its `toHaveBeenCalledWith(...,
 * client: publicBookingClient, ...)` assertions prove the CALL SITE passes
 * the right client option, but never actually exercise `publicBookingClient`
 * itself — a regression that swapped `publicBookingClient` for one that
 * silently reattached interceptors would still pass those assertions as
 * long as the mock call recorded the same object identity.
 *
 * This file, kept separate so it does NOT mock `@/client/sdk.gen`, mirrors
 * `use-public-bookable-slots.test.ts`'s dedicated regression test: it seeds
 * `localStorage` with a token and an active organization (as if a logged-in
 * member were browsing a public link), points `publicBookingClient` at a
 * mock `fetch`, and asserts the OUTGOING REQUEST carries `X-Booking-Code`
 * but neither `Authorization` nor `X-Organization-Id` — the property the
 * dedicated unauthenticated client exists to guarantee.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { publicBookingClient } from '@/lib/booking-links/public-client';
import { usePublicAppointmentTypeBookableSlots } from './use-public-appointment-type-booking';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

describe('usePublicAppointmentTypeBookableSlots (real publicBookingClient)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sends X-Booking-Code through the real public client, with no Authorization or X-Organization-Id even with a token and active org in localStorage', async () => {
    // Simulate a logged-in visitor browsing a public appointment type link.
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
        usePublicAppointmentTypeBookableSlots({
          code: 'secret-code',
          durationSeconds: 1800,
          searchWindowStart: '2026-01-01T00:00:00Z',
          searchWindowEnd: '2026-01-02T00:00:00Z',
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledOnce();
    const outgoingRequest: Request = mockFetch.mock.calls[0][0];
    expect(outgoingRequest.headers.get('X-Booking-Code')).toBe('secret-code');
    expect(outgoingRequest.headers.has('Authorization')).toBe(false);
    expect(outgoingRequest.headers.has('X-Organization-Id')).toBe(false);
    expect(result.current.data).toEqual([
      { start_time: '2026-01-01T10:00:00Z', end_time: '2026-01-01T10:30:00Z' },
    ]);
  });
});
