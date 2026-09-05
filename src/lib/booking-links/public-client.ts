import { createClient, createConfig } from '@/client/client';
import type { ClientOptions } from '@/client';

/**
 * A hey-api client for `/public/booking/*`, deliberately created with NO
 * interceptors registered.
 *
 * The shared client from `@/client/client.gen` (configured by
 * `configureClientAuthentication` in `@/lib/authentication-fetch-interceptors`)
 * injects `Authorization` and `X-Organization-Id` on every request. Those
 * headers have no business on a public booking endpoint: the whole point of
 * `/public/booking/*` is that an unauthenticated attendee, holding nothing
 * but a booking code, can call it. Sending a logged-in visitor's org header
 * there would be noise at best on a surface whose contract deliberately
 * keeps the organization out of the request (auth is via `X-Booking-Code`
 * instead — see `@/lib/booking-links/errors`).
 *
 * hey-api's generated operations accept a per-call `client` override
 * (`options.client ?? client`), so public booking pages pass this instance
 * explicitly instead of relying on the app-wide singleton.
 */
export const publicBookingClient = createClient(
  createConfig<ClientOptions>({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
  })
);
