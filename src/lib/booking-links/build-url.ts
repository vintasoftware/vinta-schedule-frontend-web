import type { PurposeEnum } from '@/client';

/**
 * The link's scope. A calendar-scoped `book`/`reschedule` link may carry an
 * advisory `durationSeconds` (appended as `?duration=`); a group-scoped link
 * has no field to populate one — a group's duration is server-pinned on
 * `CalendarGroup` and must never be echoed in the URL (see "Group duration
 * comes from the server"). This makes a group link with a client-chosen
 * duration unrepresentable rather than merely discouraged.
 */
export type BookingLinkUrlScope =
  | { kind: 'calendar'; durationSeconds?: number }
  | { kind: 'group' };

export interface BuildBookingLinkUrlParams {
  /** The plaintext booking code, minted exactly once by `bookingCodesCreate`. */
  code: string;
  purpose: PurposeEnum;
  /**
   * The active organization's slug, when known. Present → the branded route
   * (`/o/[slug]/book/[code]`); absent → the bare route (`/book/[code]`),
   * which renders default branding because a bare code has no way to look up
   * its organization (no retrieve endpoint — see the "Two public routes, one
   * branded" guiding decision).
   */
  slug?: string;
  /**
   * Ignored entirely for `purpose: 'cancel'` — `publicBookingEventsCancelCreate`
   * is a single endpoint for both single-calendar and calendar-group events,
   * so a cancel link needs no `?target=` marker and no duration. Required by
   * the type regardless, so callers don't need a second, cancel-only shape.
   */
  scope: BookingLinkUrlScope;
}

/**
 * Build the absolute, shareable booking link for a minted code.
 *
 * Purpose is encoded as a path segment for `reschedule` / `cancel` (a code
 * doesn't reveal its own purpose, so the URL has to carry it — see "Purpose
 * is in the path, not discoverable from the code"); `book` uses the bare
 * `/book/[code]` path with no extra segment.
 *
 * A `book` OR `reschedule` link also carries an explicit
 * `?target=calendar|group` marker (Phase 3 added it for `book`; Phase 4
 * extends it to `reschedule` for the same reason). `/book/[code]` and
 * `/o/[slug]/book/[code]` (and their `/reschedule` suffix) serve BOTH a
 * single-calendar and a calendar-group flow, and the page holding only a
 * code has no way to introspect which one it is — the code resolves
 * server-side, and probing (try one endpoint, fall back to the other on the
 * opaque/`NOT_PERMITTED` failure) would turn that failure into exactly the
 * state oracle it exists to prevent. Marking the target here, at mint time —
 * when the caller already knows it from `scope` — means the page never has
 * to guess or probe; see `public-booking-entry.tsx`'s
 * `resolveBookingLinkTarget`, which reads this param and NOTHING else to
 * route, for both `book` and `reschedule` pages.
 *
 * `cancel` gets neither marker: `publicBookingEventsCancelCreate` is a
 * single endpoint for both scopes (unlike reschedule's deliberately
 * un-collapsed pair), so a cancel link has nothing to route on. `scope` is
 * accepted for `cancel` (the type requires it) but never read.
 *
 * BACK-COMPAT: a calendar `book` link minted before this marker existed
 * (Phase 2) has `?duration=` but no `?target=`. `resolveBookingLinkTarget`
 * treats anything other than the literal `target=group` as calendar, so
 * those links keep working unchanged. A group `book` link minted before
 * this marker (Phase 1 shipped group minting before Phase 3 shipped a page
 * that could render one) had no query param at all and was already
 * unusable — it degrades to the same "missing a valid duration" state it
 * always has, rather than being guessed at. That's an accepted, documented
 * consequence, not a probe. `reschedule` links are new in Phase 4, so there
 * is no pre-marker `reschedule` link to preserve compatibility with.
 *
 * Browser-only: called from the mint dialog (`'use client'`), so
 * `window.location.origin` is always available. Matches the repo's existing
 * pattern for building absolute app URLs (compare
 * `src/components/authentication/login-form.tsx`).
 */
export function buildBookingLinkUrl(params: BuildBookingLinkUrlParams): string {
  const { code, purpose, slug, scope } = params;

  const encodedCode = encodeURIComponent(code);
  const basePath = slug
    ? `/o/${encodeURIComponent(slug)}/book/${encodedCode}`
    : `/book/${encodedCode}`;
  const path = purpose === 'book' ? basePath : `${basePath}/${purpose}`;

  const url = new URL(path, window.location.origin);
  if (purpose === 'book' || purpose === 'reschedule') {
    url.searchParams.set('target', scope.kind);
    if (scope.kind === 'calendar' && scope.durationSeconds != null) {
      url.searchParams.set('duration', String(scope.durationSeconds));
    }
  }

  return url.toString();
}
