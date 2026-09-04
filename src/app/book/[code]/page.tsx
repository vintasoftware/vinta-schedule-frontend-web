import { Suspense } from 'react';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';
import { PublicBookingShell } from '@/components/public-booking/public-booking-shell';
import { PublicBookingFlow } from '@/components/public-booking/public-booking-flow';

/**
 * Bare public booking route — `/book/[code]`.
 *
 * Renders default (vinta) branding: a code alone can't be resolved to an
 * organization (there is no retrieve endpoint for booking codes — see the
 * plan's "No link inventory" guiding decision), so there's nothing to look
 * branding up by. `/o/[slug]/book/[code]` is the branded counterpart.
 *
 * Sits outside the `(app)` route group so the authenticated shell's
 * org/session gating never touches it — this page must be reachable by an
 * anonymous visitor holding nothing but the code.
 */
export default async function BookPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <PublicBookingShell branding={VINTA_DEFAULT_BRANDING}>
      {/* PublicBookingFlow reads `?duration=` via useSearchParams(), which
          requires a Suspense boundary — same convention as the branded
          login page's LoginForm. */}
      <Suspense fallback={null}>
        <PublicBookingFlow code={code} />
      </Suspense>
    </PublicBookingShell>
  );
}
