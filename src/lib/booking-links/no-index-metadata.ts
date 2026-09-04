import type { Metadata } from 'next';

/**
 * `metadata.robots` for every public booking route (`/book/*`,
 * `/o/[slug]/book/*`, and later `/g/*`, `/o/[slug]/g/*`).
 *
 * A booking code travels in the URL and is a live, single-use credential
 * (see the plan's "No link inventory" and "A booking code is a credential
 * with exactly one delivery" guiding decisions). A search index entry for
 * one of these routes is a leaked credential, so the plan's Open Questions
 * table resolves this unconditionally: "No — `noindex` on every `/book/*`
 * and `/g/*` route." Import this into every new public booking `page.tsx`
 * rather than hand-rolling the object, so a later route can't silently
 * regress. `src/app/robots.ts` disallows the same paths at the crawler
 * level; this is the belt-and-suspenders per-page tag.
 */
export const NO_INDEX_METADATA: Metadata = {
  robots: { index: false, follow: false },
};
