import { Suspense } from 'react';
import { fetchBrandingForSlug } from '@/lib/branding-server';
import { NO_INDEX_METADATA } from '@/lib/booking-links/no-index-metadata';
import { PublicBookingShell } from '@/components/public-booking/public-booking-shell';
import { PublicBookingEntry } from '@/components/public-booking/public-booking-entry';

/**
 * `noindex` — a booking code in the URL is a live credential. See the plan's
 * Open Questions row "Should the public booking pages be indexable?"
 * (resolved: no). Do not remove this thinking it is dead weight.
 */
export const metadata = NO_INDEX_METADATA;

/**
 * Branded public booking route — `/o/[slug]/book/[code]`.
 *
 * Resolves branding through `fetchBrandingForSlug` (`@/lib/branding-server`),
 * following the branded login page (`o/[slug]/auth/login/page.tsx`). An
 * unknown/removed slug resolves to `VINTA_DEFAULT_BRANDING` rather than
 * erroring.
 *
 * `slug` is ALSO passed straight through to `PublicBookingEntry` (Phase 5):
 * once a booking succeeds, its confirmation renders self-service
 * reschedule/cancel links, and this route — unlike the bare `/book/[code]`
 * counterpart — already has the org slug in its own params, so those links
 * can use the branded `/o/[slug]/...` form. This is the only piece of the
 * tenancy contract this page carries; it never resolves an id or scopes any
 * request with it.
 *
 * Sits outside the `(app)` route group so the authenticated shell's
 * org/session gating never touches it.
 */
export default async function BrandedBookPage({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = await params;
  const branding = await fetchBrandingForSlug(slug);

  return (
    <PublicBookingShell branding={branding}>
      <Suspense fallback={null}>
        <PublicBookingEntry code={code} slug={slug} />
      </Suspense>
    </PublicBookingShell>
  );
}
