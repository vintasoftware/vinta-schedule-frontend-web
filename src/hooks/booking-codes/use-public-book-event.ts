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
 */

import { useMutation } from '@tanstack/react-query';
import { publicBookingCalendarEventsCreate } from '@/client/sdk.gen';
import type { BookingCodeEventCreate, CalendarEvent } from '@/client';
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
    CalendarEvent,
    PublicWriteFailureError,
    PublicBookEventParams
  >({
    // A retried write after the server already committed a create would risk
    // a duplicate booking attempt against a single-use code; fail once and
    // let the caller decide (SLOT_UNAVAILABLE sends the attendee back to
    // slot selection deliberately, not via an automatic retry here).
    retry: false,
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
  ): Promise<CalendarEvent> => bookEventMutation.mutateAsync(params);

  return { bookEvent, bookEventMutation };
}
