import { fetchBrandingForSlug } from '@/lib/branding-server';
import { NO_INDEX_METADATA } from '@/lib/booking-links/no-index-metadata';
import { PublicBookingShell } from '@/components/public-booking/public-booking-shell';
import { CodelessGroupBookingFlow } from '@/components/public-booking/codeless-group-booking-flow';

/**
 * `noindex` — see the plan's Open Questions row "Should the public booking
 * pages be indexable?" (resolved: no, on every `/book/*` and `/g/*` route).
 * Do not remove this thinking it is dead weight.
 */
export const metadata = NO_INDEX_METADATA;

/**
 * Branded codeless public group booking route —
 * `/o/[slug]/g/[public_slug]`.
 *
 * Resolves branding through `fetchBrandingForSlug`, following the branded
 * `/o/[slug]/book/[code]` route. An unknown/removed org slug resolves to
 * `VINTA_DEFAULT_BRANDING` rather than erroring.
 *
 * `slug` is ALSO passed straight through to `CodelessGroupBookingFlow`: once
 * a booking succeeds, its confirmation renders self-service
 * reschedule/cancel links (Phase 5), and this route — unlike
 * `/g/[public_slug]` — already has the org slug in its own params, so those
 * links can use the branded `/o/[slug]/...` form.
 *
 * Sits outside the `(app)` route group so the authenticated shell's
 * org/session gating never touches it.
 */
export default async function BrandedCodelessGroupBookingPage({
  params,
}: {
  params: Promise<{ slug: string; public_slug: string }>;
}) {
  const { slug, public_slug: publicSlug } = await params;
  const branding = await fetchBrandingForSlug(slug);

  return (
    <PublicBookingShell branding={branding}>
      <CodelessGroupBookingFlow publicSlug={publicSlug} slug={slug} />
    </PublicBookingShell>
  );
}
