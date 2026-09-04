import type { MetadataRoute } from 'next';

/**
 * Disallow crawling of every public booking route. A booking code travels in
 * the URL and is a live, single-use credential (see the implementation
 * plan's Open Questions row "Should the public booking pages be indexable?",
 * resolved "No — `noindex` on every `/book/*` and `/g/*` route"). The `/g/*`
 * routes (Phase 7) carry no code — they're addressed by a stable, reusable
 * `public_booking_slug` — but they're still an unauthenticated write surface
 * for an organization's calendar group, so the same resolution covers them
 * unconditionally, not just the credential-bearing ones. Per-page
 * `metadata.robots` (see `@/lib/booking-links/no-index-metadata`) is the
 * belt; this crawler-level disallow is the suspenders.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: [
        '/book',
        '/book/*',
        '/o/*/book',
        '/o/*/book/*',
        '/g',
        '/g/*',
        '/o/*/g',
        '/o/*/g/*',
      ],
    },
  };
}
