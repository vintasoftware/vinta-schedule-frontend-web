'use client';

/**
 * PublicBookingEntry — routes a `/book/[code]` (or `/o/[slug]/book/[code]`)
 * visit to the single-calendar flow or the appointment-type flow, based
 * SOLELY on the `?target=` marker `buildBookingLinkUrl` writes into the URL
 * at mint time.
 *
 * This is the load-bearing piece of Phase 3's routing decision: the page
 * cannot introspect a booking code to learn its target, and a
 * probe-and-fallback (try the calendar read, fall back to the appointment type read on
 * the opaque 403) would turn that uniform 403 into exactly the state oracle
 * it exists to prevent (see the plan's "The opaque 403 is not an auth
 * failure" guiding decision). So this component reads ONE query param,
 * makes a deterministic, purely local decision, and mounts exactly one
 * flow — it never calls either flow's read hook itself, and never renders
 * both to "see which one works".
 *
 * `resolveBookingLinkTarget` is exported and unit-tested in isolation
 * (`public-booking-entry.test.tsx`) specifically to prove this: given a
 * `URLSearchParams`, it returns a target with ZERO network access.
 */

import { useSearchParams } from 'next/navigation';
import { PublicBookingFlow } from './public-booking-flow';
import { PublicAppointmentTypeBookingFlow } from './public-appointment-type-booking-flow';

export type BookingLinkTarget = 'calendar' | 'appointmentType';

/**
 * The `?target=` values that select the appointment-type flow.
 *
 * `appointmentType` is what `buildBookingLinkUrl` mints today. `group` is the
 * value it minted before the CalendarGroup → AppointmentType rename, and is
 * still accepted because minted links are shareable and long-lived: a
 * reschedule link sitting in an attendee's inbox from before the rename must
 * keep resolving to the appointment-type flow rather than silently falling
 * back to `calendar`. Read-only back-compat — nothing emits `group` anymore.
 */
const APPOINTMENT_TYPE_TARGETS = ['appointmentType', 'group'];

/**
 * Resolve which flow to mount from the URL alone — no network access.
 *
 * Only an appointment-type marker (see `APPOINTMENT_TYPE_TARGETS`) selects the
 * appointment type flow. Everything else (an explicit `target=calendar`, a
 * missing `target`, or anything malformed) resolves to `calendar` — which is
 * exactly Phase 2's original, unconditional behavior. This is what keeps a
 * calendar link minted before this marker existed (carrying `?duration=` but
 * no `?target=`) working unchanged: it was never anything but a calendar
 * link, and the absence of the new marker doesn't change that. See
 * `build-url.ts`'s doc comment for the appointment-type-link back-compat
 * consequence of this same default.
 */
export function resolveBookingLinkTarget(
  searchParams: URLSearchParams
): BookingLinkTarget {
  const target = searchParams.get('target');
  return target !== null && APPOINTMENT_TYPE_TARGETS.includes(target)
    ? 'appointmentType'
    : 'calendar';
}

export interface PublicBookingEntryProps {
  /** Plaintext booking code from the URL. */
  code: string;
  /**
   * Active organization slug, when known — passed straight through to
   * whichever flow this mounts, so its confirmation can build branded
   * self-service links. `undefined` on the bare `/book/[code]` route.
   */
  slug?: string;
}

export function PublicBookingEntry({ code, slug }: PublicBookingEntryProps) {
  const searchParams = useSearchParams();
  const target = resolveBookingLinkTarget(searchParams);

  if (target === 'appointmentType') {
    return <PublicAppointmentTypeBookingFlow code={code} slug={slug} />;
  }
  return <PublicBookingFlow code={code} slug={slug} />;
}
