import { Suspense } from 'react';
import { fetchBrandingForSlug } from '@/lib/branding-server';
import { PublicBookingShell } from '@/components/public-booking/public-booking-shell';
import { PublicBookingFlow } from '@/components/public-booking/public-booking-flow';

/**
 * Branded public booking route — `/o/[slug]/book/[code]`.
 *
 * Resolves branding through `fetchBrandingForSlug` (`@/lib/branding-server`),
 * following the branded login page (`o/[slug]/auth/login/page.tsx`). An
 * unknown/removed slug resolves to `VINTA_DEFAULT_BRANDING` rather than
 * erroring — `slug` is display-only here, same as on the login route.
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
        <PublicBookingFlow code={code} />
      </Suspense>
    </PublicBookingShell>
  );
}
