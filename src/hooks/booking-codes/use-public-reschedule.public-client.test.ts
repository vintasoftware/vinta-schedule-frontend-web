/**
 * usePublicReschedule — dedicated public-client regression test.
 *
 * `use-public-reschedule.test.ts` mocks `@/client/sdk.gen` at module scope,
 * so its assertions prove the call site passes `client: publicBookingClient`
 * by identity, but never actually exercise the client's fetch pipeline — see
 * `use-public-appointment-type-booking.public-client.test.ts` for the same concern and
 * fix, applied here. This file, kept separate so it does NOT mock
 * `@/client/sdk.gen`, seeds `localStorage` with a token and an active
 * organization (as if a logged-in member were browsing a public link),
 * points `publicBookingClient` at a mock `fetch`, and asserts the OUTGOING
 * REQUEST carries `X-Booking-Code` but neither `Authorization` nor
 * `X-Organization-Id`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';

import { publicBookingClient } from '@/lib/booking-links/public-client';
import { usePublicReschedule } from './use-public-reschedule';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

describe('usePublicReschedule (real publicBookingClient)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sends X-Booking-Code through the real public client, with no Authorization or X-Organization-Id even with a token and active org in localStorage', async () => {
    localStorage.setItem('accessToken', 'a-real-jwt-token');
    localStorage.setItem('activeOrganizationId', 'org-42');

    const event = {
      id: 1,
      title: 'Appointment',
      start_time: '2026-03-02T11:00:00.000Z',
      end_time: '2026-03-02T11:30:00.000Z',
      timezone: 'UTC',
    };
    const mockFetch = vi.fn(
      async (_req: Request) =>
        new Response(JSON.stringify(event), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    publicBookingClient.setConfig({
      fetch: mockFetch as unknown as typeof fetch,
      baseUrl: 'http://test.local',
    });

    const Wrapper = createWrapper();
    const { result } = renderHook(() => usePublicReschedule(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.reschedule({
        code: 'secret-code',
        target: 'calendar',
        body: {
          start_time: '2026-03-02T11:00:00.000Z',
          end_time: '2026-03-02T11:30:00.000Z',
          timezone: 'UTC',
        },
      });
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const outgoingRequest: Request = mockFetch.mock.calls[0][0];
    expect(outgoingRequest.headers.get('X-Booking-Code')).toBe('secret-code');
    expect(outgoingRequest.headers.has('Authorization')).toBe(false);
    expect(outgoingRequest.headers.has('X-Organization-Id')).toBe(false);
  });
});
