import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';
import { NO_INDEX_METADATA } from '@/lib/booking-links/no-index-metadata';
import { PublicBookingShell } from '@/components/public-booking/public-booking-shell';
import { CancelFlow } from '@/components/public-booking/cancel-flow';

/**
 * `noindex` — a booking code in the URL is a live credential. See the plan's
 * Open Questions row "Should the public booking pages be indexable?"
 * (resolved: no). Do not remove this thinking it is dead weight.
 */
export const metadata = NO_INDEX_METADATA;

/**
 * Bare public cancel route — `/book/[code]/cancel`.
 *
 * Renders default (vinta) branding — same reasoning as the bare
 * `/book/[code]` book route. `/o/[slug]/book/[code]/cancel` is the branded
 * counterpart.
 *
 * `CancelFlow` reads no URL search params (cancel is a single endpoint for
 * both scopes, so there is no `?target=` to route on — see that
 * component's doc comment), so unlike the book/reschedule routes this page
 * needs no `Suspense` boundary.
 *
 * Sits outside the `(app)` route group so the authenticated shell's
 * org/session gating never touches it.
 */
export default async function BookCancelPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <PublicBookingShell branding={VINTA_DEFAULT_BRANDING}>
      <CancelFlow code={code} />
    </PublicBookingShell>
  );
}
