import { Suspense } from 'react';
import { fetchBrandingForSlug } from '@/lib/branding-server';
import { NO_INDEX_METADATA } from '@/lib/booking-links/no-index-metadata';
import { PublicBookingShell } from '@/components/public-booking/public-booking-shell';
import { RescheduleFlow } from '@/components/public-booking/reschedule-flow';

/**
 * `noindex` — a booking code in the URL is a live credential. See the plan's
 * Open Questions row "Should the public booking pages be indexable?"
 * (resolved: no). Do not remove this thinking it is dead weight.
 */
export const metadata = NO_INDEX_METADATA;

/**
 * Branded public reschedule route — `/o/[slug]/book/[code]/reschedule`.
 *
 * Resolves branding through `fetchBrandingForSlug`, same as the branded
 * `/o/[slug]/book/[code]` book route. An unknown/removed slug resolves to
 * `VINTA_DEFAULT_BRANDING` rather than erroring.
 *
 * Sits outside the `(app)` route group so the authenticated shell's
 * org/session gating never touches it.
 */
export default async function BrandedBookReschedulePage({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = await params;
  const branding = await fetchBrandingForSlug(slug);

  return (
    <PublicBookingShell branding={branding}>
      <Suspense fallback={null}>
        <RescheduleFlow code={code} />
      </Suspense>
    </PublicBookingShell>
  );
}
