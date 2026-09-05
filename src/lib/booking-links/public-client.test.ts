import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression test for the whole "dedicated unauthenticated client" decision
 * (see public-client.ts). A request issued through `publicBookingClient` must
 * carry neither `Authorization` nor `X-Organization-Id` — even when a token
 * AND an active organization are both present in localStorage, which is
 * exactly the state a logged-in member browsing a public booking link would
 * be in.
 *
 * Deliberately does NOT call `configureClientAuthentication` — the point of
 * `publicBookingClient` is that it's a client instance those interceptors
 * were never registered on in the first place.
 */
describe('publicBookingClient', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('attaches no Authorization or X-Organization-Id header, even with a token and active org in localStorage', async () => {
    // Simulate a logged-in visitor: an access token and an active
    // organization both sitting in localStorage.
    localStorage.setItem('accessToken', 'a-real-jwt-token');
    localStorage.setItem('activeOrganizationId', 'org-42');

    const { publicBookingClient } = await import('./public-client');

    const mockFetch = vi.fn(async (_req: Request) => {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    publicBookingClient.setConfig({
      fetch: mockFetch as unknown as typeof fetch,
      baseUrl: 'http://test.local',
    });

    await publicBookingClient.get({
      url: '/public/booking/calendar-bookable-slots/',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const outgoingRequest: Request = mockFetch.mock.calls[0][0];
    expect(outgoingRequest.headers.has('Authorization')).toBe(false);
    expect(outgoingRequest.headers.has('X-Organization-Id')).toBe(false);
  });

  it('is a distinct client instance from the shared authenticated client', async () => {
    const { publicBookingClient } = await import('./public-client');
    const { client: sharedClient } = await import('@/client/client.gen');

    expect(publicBookingClient).not.toBe(sharedClient);
  });
});
