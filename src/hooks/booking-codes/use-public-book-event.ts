/**
 * usePublicBookEvent — book an event on a single calendar with a public
 * booking code.
 *
 * Same "call the raw sdk function, not the generated `*Mutation` factory"
 * reasoning as `use-public-bookable-slots.ts`: the generated
 * `publicBookingCalendarEventsCreateMutation` hardcodes `throwOnError: true`,
 * which throws only the parsed error body and drops the `Response` — and
 * `parseWriteFailure` needs both. Every call goes through
 * `publicBookingClient`, never the shared authenticated client.
 *
 * Failures map to a `PublicWriteFailureError` carrying the parsed
 * `PublicWriteFailure` (`errorCode`, `detail`, `isRetryable`). Only
 * `SLOT_UNAVAILABLE` is retryable — it does not consume the code, so the
 * caller (the booking flow) should send the attendee back to slot selection
 * and refetch the slot list. Every other `error_code` is terminal.
 *
 * SECURITY (Phase 5): the `201` now carries `management.reschedule_code` /
 * `management.cancel_code` — plaintext, single-use, self-service codes
 * (`CalendarEventWithManagementCodes`). Same no-persistence discipline as
 * `useCreateBookingCode`: `gcTime: 0` keeps that response out of the
 * TanStack *mutation* cache beyond the last attached observer, rather than
 * lingering for the app's default 5-minute mutation `gcTime` — see that
 * hook's doc comment for the full mechanics (`MutationObserver.reset()` only
 * schedules collection; `gcTime: 0` is what makes it immediate). The caller
 * (`public-booking-flow.tsx`) additionally holds the result in local
 * component state only, never re-derives it from `bookEventMutation.data`.
 */

import { useMutation } from '@tanstack/react-query';
import { publicBookingCalendarEventsCreate } from '@/client/sdk.gen';
import type {
  BookingCodeEventCreate,
  CalendarEventWithManagementCodes,
} from '@/client';
import { publicBookingClient } from '@/lib/booking-links/public-client';
import {
  parseWriteFailure,
  PublicWriteFailureError,
} from '@/lib/booking-links/errors';

export interface PublicBookEventParams {
  /** Plaintext booking code from the URL — sent as `X-Booking-Code`. */
  code: string;
  body: BookingCodeEventCreate;
}

export function usePublicBookEvent() {
  const bookEventMutation = useMutation<
    CalendarEventWithManagementCodes,
    PublicWriteFailureError,
    PublicBookEventParams
  >({
    // A retried write after the server already committed a create would risk
    // a duplicate booking attempt against a single-use code; fail once and
    // let the caller decide (SLOT_UNAVAILABLE sends the attendee back to
    // slot selection deliberately, not via an automatic retry here).
    retry: false,
    // See the SECURITY note above — keeps the plaintext management codes out
    // of the mutation cache beyond the last attached observer.
    gcTime: 0,
    mutationFn: async ({ code, body }) => {
      const { data, error, response } = await publicBookingCalendarEventsCreate(
        {
          client: publicBookingClient,
          headers: { 'X-Booking-Code': code },
          body,
        }
      );

      if (response && response.ok && data !== undefined) {
        return data;
      }

      const failure = response
        ? parseWriteFailure(response, error)
        : { errorCode: null, detail: 'Request failed', isRetryable: false };
      throw new PublicWriteFailureError(failure);
    },
  });

  const bookEvent = async (
    params: PublicBookEventParams
  ): Promise<CalendarEventWithManagementCodes> =>
    bookEventMutation.mutateAsync(params);

  return { bookEvent, bookEventMutation };
}
