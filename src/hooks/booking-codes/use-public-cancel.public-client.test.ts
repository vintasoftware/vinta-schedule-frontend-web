/**
 * usePublicCancel — dedicated public-client regression test.
 *
 * See `use-public-reschedule.public-client.test.ts` for why this lives in
 * its own file that does NOT mock `@/client/sdk.gen`: it drives a real
 * request through `publicBookingClient` and asserts the outgoing headers,
 * rather than trusting a mocked call-site assertion.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { publicBookingClient } from '@/lib/booking-links/public-client';
import { usePublicCancel } from './use-public-cancel';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

describe('usePublicCancel (real publicBookingClient)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sends X-Booking-Code through the real public client, with no Authorization or X-Organization-Id even with a token and active org in localStorage', async () => {
    localStorage.setItem('accessToken', 'a-real-jwt-token');
    localStorage.setItem('activeOrganizationId', 'org-42');

    const mockFetch = vi.fn(
      async (_req: Request) => new Response(null, { status: 204 })
    );
    publicBookingClient.setConfig({
      fetch: mockFetch as unknown as typeof fetch,
      baseUrl: 'http://test.local',
    });

    const Wrapper = createWrapper();
    const { result } = renderHook(() => usePublicCancel(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.cancel({ code: 'secret-code' });
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const outgoingRequest: Request = mockFetch.mock.calls[0][0];
    expect(outgoingRequest.headers.get('X-Booking-Code')).toBe('secret-code');
    expect(outgoingRequest.headers.has('Authorization')).toBe(false);
    expect(outgoingRequest.headers.has('X-Organization-Id')).toBe(false);
  });
});
