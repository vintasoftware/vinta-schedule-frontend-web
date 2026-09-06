import { fetchBrandingForSlug } from '@/lib/branding-server';
import { NO_INDEX_METADATA } from '@/lib/booking-links/no-index-metadata';
import { PublicBookingShell } from '@/components/public-booking/public-booking-shell';
import { CodelessAppointmentTypeBookingFlow } from '@/components/public-booking/codeless-appointment-type-booking-flow';

/**
 * `noindex` — see the plan's Open Questions row "Should the public booking
 * pages be indexable?" (resolved: no, on every `/book/*` and `/g/*` route).
 * Do not remove this thinking it is dead weight.
 */
export const metadata = NO_INDEX_METADATA;

/**
 * Branded codeless public appointment type booking route —
 * `/o/[slug]/g/[public_slug]`.
 *
 * Resolves branding through `fetchBrandingForSlug`, following the branded
 * `/o/[slug]/book/[code]` route. An unknown/removed org slug resolves to
 * `VINTA_DEFAULT_BRANDING` rather than erroring.
 *
 * `slug` is ALSO passed straight through to `CodelessAppointmentTypeBookingFlow`: once
 * a booking succeeds, its confirmation renders self-service
 * reschedule/cancel links (Phase 5), and this route — unlike
 * `/g/[public_slug]` — already has the org slug in its own params, so those
 * links can use the branded `/o/[slug]/...` form.
 *
 * Sits outside the `(app)` route appointment type so the authenticated shell's
 * org/session gating never touches it.
 */
export default async function BrandedCodelessAppointmentTypeBookingPage({
  params,
}: {
  params: Promise<{ slug: string; public_slug: string }>;
}) {
  const { slug, public_slug: publicSlug } = await params;
  const branding = await fetchBrandingForSlug(slug);

  return (
    <PublicBookingShell branding={branding}>
      <CodelessAppointmentTypeBookingFlow publicSlug={publicSlug} slug={slug} />
    </PublicBookingShell>
  );
}
