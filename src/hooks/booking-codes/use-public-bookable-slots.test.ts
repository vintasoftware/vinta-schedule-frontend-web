/**
 * usePublicBookableSlots tests.
 *
 * Covers:
 * - The code reaches the server as `X-Booking-Code`.
 * - The request goes through the dedicated `publicBookingClient`.
 * - No `Authorization` (or `X-Organization-Id`) header is attached even with
 *   a token AND an active organization sitting in `localStorage` — this is
 *   the regression test for the whole dedicated-unauthenticated-client
 *   decision (see `@/lib/booking-links/public-client.ts`), exercised through
 *   the hook this time rather than the raw client directly.
 * - An opaque 403 on the read maps to `PublicReadFailureError('link-invalid')`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { publicBookingClient } from '@/lib/booking-links/public-client';
import { PublicReadFailureError } from '@/lib/booking-links/errors';
import { usePublicBookableSlots } from './use-public-bookable-slots';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

describe('usePublicBookableSlots', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sends the code as X-Booking-Code through the public client, with no Authorization or X-Organization-Id header even with a token and active org in localStorage', async () => {
    // Simulate a logged-in visitor browsing a public link.
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
        usePublicBookableSlots({
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

  it('maps an opaque 403 read failure to PublicReadFailureError with state link-invalid, regardless of the response body', async () => {
    const mockFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: 'Invalid or expired code.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    publicBookingClient.setConfig({
      fetch: mockFetch as unknown as typeof fetch,
      baseUrl: 'http://test.local',
    });

    const Wrapper = createWrapper();
    const { result } = renderHook(
      () =>
        usePublicBookableSlots({
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
    const mockFetch = vi.fn();
    publicBookingClient.setConfig({
      fetch: mockFetch as unknown as typeof fetch,
      baseUrl: 'http://test.local',
    });

    const Wrapper = createWrapper();
    renderHook(
      () =>
        usePublicBookableSlots({
          code: 'secret-code',
          durationSeconds: 1800,
          searchWindowStart: '2026-01-01T00:00:00Z',
          searchWindowEnd: '2026-01-02T00:00:00Z',
          enabled: false,
        }),
      { wrapper: Wrapper }
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
