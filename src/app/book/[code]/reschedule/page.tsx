import { Suspense } from 'react';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';
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
 * Bare public reschedule route — `/book/[code]/reschedule`.
 *
 * Renders default (vinta) branding — same reasoning as the bare
 * `/book/[code]` book route: a code alone can't be resolved to an
 * organization. `/o/[slug]/book/[code]/reschedule` is the branded
 * counterpart.
 *
 * Sits outside the `(app)` route group so the authenticated shell's
 * org/session gating never touches it.
 */
export default async function BookReschedulePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <PublicBookingShell branding={VINTA_DEFAULT_BRANDING}>
      {/* RescheduleFlow reads the URL via useSearchParams() (the `?target=`
          marker), which requires a Suspense boundary — same convention as
          the book route's PublicBookingEntry. */}
      <Suspense fallback={null}>
        <RescheduleFlow code={code} />
      </Suspense>
    </PublicBookingShell>
  );
}
