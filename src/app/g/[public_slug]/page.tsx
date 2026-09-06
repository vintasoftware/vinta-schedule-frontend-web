import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';
import { NO_INDEX_METADATA } from '@/lib/booking-links/no-index-metadata';
import { PublicBookingShell } from '@/components/public-booking/public-booking-shell';
import { CodelessAppointmentTypeBookingFlow } from '@/components/public-booking/codeless-appointment-type-booking-flow';

/**
 * `noindex` — see the plan's Open Questions row "Should the public booking
 * pages be indexable?" (resolved: no, on every `/book/*` **and `/g/*`**
 * route). This route carries no credential in the URL the way a `/book/*`
 * link does, but it is still an unauthenticated write surface for an
 * organization's appointment type and gets the same treatment. Do not remove
 * this thinking it is dead weight.
 */
export const metadata = NO_INDEX_METADATA;

/**
 * Bare codeless public appointment type booking route — `/g/[public_slug]`.
 *
 * Renders default (vinta) branding, same reasoning as the bare
 * `/book/[code]` route: nothing in a bare `public_booking_slug` identifies
 * an organization to look branding up by. `/o/[slug]/g/[public_slug]` is
 * the branded counterpart.
 *
 * Unlike `/book/[code]`, this route reads no `?target=` or `?duration=`
 * search param at all (there is no code to route on, and the appointment type's own
 * pinned duration is server-resolved) — so, unlike that route, this needs
 * no `Suspense` boundary for `useSearchParams()`.
 *
 * Sits outside the `(app)` route appointment type so the authenticated shell's
 * org/session gating never touches it — this page must be reachable by an
 * anonymous visitor holding nothing but the appointment type's public link.
 */
export default async function CodelessAppointmentTypeBookingPage({
  params,
}: {
  params: Promise<{ public_slug: string }>;
}) {
  const { public_slug: publicSlug } = await params;

  return (
    <PublicBookingShell branding={VINTA_DEFAULT_BRANDING}>
      <CodelessAppointmentTypeBookingFlow publicSlug={publicSlug} />
    </PublicBookingShell>
  );
}
