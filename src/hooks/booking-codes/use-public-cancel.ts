/**
 * usePublicCancel — cancel the event bound to a public booking code.
 *
 * `POST /public/booking/events/cancel/` is a single endpoint for both
 * single-calendar and appointment-type events (unlike reschedule, which is
 * deliberately split across two endpoints — see `use-public-reschedule.ts`),
 * so this hook needs no `target` param and never routes on one.
 *
 * Returns `204 No Content` on success — there is no body to parse, so the
 * mutation resolves `void` rather than a `CalendarEvent`. Same "call the raw
 * sdk function, not the generated `*Mutation` factory" reasoning as the
 * other public write hooks: the generated factory hardcodes
 * `throwOnError: true`, dropping the `Response` that `parseWriteFailure`
 * needs. Every call goes through `publicBookingClient`.
 */

import { useMutation } from '@tanstack/react-query';
import { publicBookingEventsCancelCreate } from '@/client/sdk.gen';
import { publicBookingClient } from '@/lib/booking-links/public-client';
import {
  parseWriteFailure,
  PublicWriteFailureError,
} from '@/lib/booking-links/errors';

export interface PublicCancelParams {
  /** Plaintext booking code from the URL — sent as `X-Booking-Code`. */
  code: string;
}

export function usePublicCancel() {
  const cancelMutation = useMutation<
    void,
    PublicWriteFailureError,
    PublicCancelParams
  >({
    // Same reasoning as the other public write hooks: a retried write after
    // the server already committed the cancel would risk a confusing second
    // error against a single-use, now-consumed code.
    retry: false,
    mutationFn: async ({ code }) => {
      const { error, response } = await publicBookingEventsCancelCreate({
        client: publicBookingClient,
        headers: { 'X-Booking-Code': code },
      });

      if (response && response.ok) {
        // 204 No Content — nothing to parse or return.
        return;
      }

      const failure = response
        ? parseWriteFailure(response, error)
        : { errorCode: null, detail: 'Request failed', isRetryable: false };
      throw new PublicWriteFailureError(failure);
    },
  });

  const cancel = async (params: PublicCancelParams): Promise<void> =>
    cancelMutation.mutateAsync(params);

  return { cancel, cancelMutation };
}
