/**
 * usePublicReschedule — reschedule the event bound to a public booking code,
 * on a single calendar OR a calendar group.
 *
 * RULE — NO PROBING (see the plan's "Two reschedule endpoints, not
 * collapsed" note, and `build-url.ts`'s doc comment): the backend
 * deliberately keeps `publicBookingEventsRescheduleCreate` (single-calendar)
 * and `publicBookingGroupEventsRescheduleCreate` (group) as two distinct
 * endpoints, and calling the wrong one for a given code answers
 * `403 NOT_PERMITTED` rather than routing through. This hook NEVER tries one
 * and falls back to the other on that failure — `target` is a
 * caller-supplied, URL-resolved value (`resolveBookingLinkTarget`, reading
 * the `?target=` marker `buildBookingLinkUrl` wrote at MINT time), decided
 * once, before any network call. There is no retry-with-the-other-endpoint
 * path anywhere in this file.
 *
 * Same "call the raw sdk function, not the generated `*Mutation` factory"
 * reasoning as `use-public-book-event.ts`: the generated factories hardcode
 * `throwOnError: true`, which throws only the parsed error BODY and drops
 * the `Response` that `parseWriteFailure` needs. Every call goes through
 * `publicBookingClient`, never the shared authenticated client.
 *
 * SECURITY (Phase 5): the `201` re-issues a FRESH pair of self-service
 * codes (`management.reschedule_code` / `management.cancel_code`,
 * `CalendarEventWithManagementCodes`) so the chain continues. Same
 * `gcTime: 0` no-persistence discipline as `usePublicBookEvent` — see that
 * hook's doc comment for the full mechanics.
 */

import { useMutation } from '@tanstack/react-query';
import {
  publicBookingEventsRescheduleCreate,
  publicBookingGroupEventsRescheduleCreate,
} from '@/client/sdk.gen';
import type {
  BookingCodeReschedule,
  CalendarEventWithManagementCodes,
} from '@/client';
import { publicBookingClient } from '@/lib/booking-links/public-client';
import {
  parseWriteFailure,
  PublicWriteFailureError,
} from '@/lib/booking-links/errors';
import type { BookingLinkTarget } from '@/components/public-booking/public-booking-entry';

export interface PublicRescheduleParams {
  /** Plaintext booking code from the URL — sent as `X-Booking-Code`. */
  code: string;
  /**
   * Which of the two reschedule endpoints to call — resolved from the URL's
   * `?target=` marker by the caller (`resolveBookingLinkTarget`), NEVER
   * guessed or tried-then-recovered here. See the module doc comment.
   */
  target: BookingLinkTarget;
  /** Times only — title, description, attendees and resource allocations
   * are snapshotted server-side from the existing event. */
  body: BookingCodeReschedule;
}

export function usePublicReschedule() {
  const rescheduleMutation = useMutation<
    CalendarEventWithManagementCodes,
    PublicWriteFailureError,
    PublicRescheduleParams
  >({
    // A retried write after the server already committed a reschedule would
    // risk re-hitting a single-use, now-consumed code with a confusing
    // second error — fail once, same reasoning as `usePublicBookEvent`.
    retry: false,
    gcTime: 0,
    mutationFn: async ({ code, target, body }) => {
      const { data, error, response } =
        target === 'group'
          ? await publicBookingGroupEventsRescheduleCreate({
              client: publicBookingClient,
              headers: { 'X-Booking-Code': code },
              body,
            })
          : await publicBookingEventsRescheduleCreate({
              client: publicBookingClient,
              headers: { 'X-Booking-Code': code },
              body,
            });

      if (response && response.ok && data !== undefined) {
        return data;
      }

      const failure = response
        ? parseWriteFailure(response, error)
        : { errorCode: null, detail: 'Request failed', isRetryable: false };
      throw new PublicWriteFailureError(failure);
    },
  });

  const reschedule = async (
    params: PublicRescheduleParams
  ): Promise<CalendarEventWithManagementCodes> =>
    rescheduleMutation.mutateAsync(params);

  return { reschedule, rescheduleMutation };
}
