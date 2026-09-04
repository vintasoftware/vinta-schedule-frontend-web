import type { MetadataRoute } from 'next';

/**
 * Disallow crawling of every public booking route. A booking code travels in
 * the URL and is a live, single-use credential (see the implementation
 * plan's Open Questions row "Should the public booking pages be indexable?",
 * resolved "No — `noindex` on every `/book/*` and `/g/*` route"). Per-page
 * `metadata.robots` (see `@/lib/booking-links/no-index-metadata`) is the
 * belt; this crawler-level disallow is the suspenders. Extend the
 * `disallow` list here as later phases add more public routes
 * (`/o/[slug]/g/*`, etc.) rather than relying on per-page tags alone.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: ['/book', '/book/*', '/o/*/book', '/o/*/book/*'],
    },
  };
}
