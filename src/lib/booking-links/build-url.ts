import type { PurposeEnum } from '@/client';

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
   * The link's scope. A calendar-scoped `book` link may carry an advisory
   * `durationSeconds` (appended as `?duration=`); a group-scoped link has no
   * field to populate one — a group's duration is server-pinned on
   * `CalendarGroup` and must never be echoed in the URL (see "Group duration
   * comes from the server"). This makes a group link with a client-chosen
   * duration unrepresentable rather than merely discouraged.
   */
  scope: { kind: 'calendar'; durationSeconds?: number } | { kind: 'group' };
}

/**
 * Build the absolute, shareable booking link for a minted code.
 *
 * Purpose is encoded as a path segment for `reschedule` / `cancel` (a code
 * doesn't reveal its own purpose, so the URL has to carry it — see "Purpose
 * is in the path, not discoverable from the code"); `book` uses the bare
 * `/book/[code]` path with no extra segment.
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
  if (
    purpose === 'book' &&
    scope.kind === 'calendar' &&
    scope.durationSeconds != null
  ) {
    url.searchParams.set('duration', String(scope.durationSeconds));
  }

  return url.toString();
}
