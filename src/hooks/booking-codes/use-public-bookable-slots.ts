/**
 * usePublicBookableSlots — bookable slot proposals for the calendar bound to
 * a public booking code.
 *
 * Unauthenticated, code-gated read: the code travels as `X-Booking-Code`
 * (never a path segment or body field — see the plan's "Code transport"
 * guiding decision) and every call goes through `publicBookingClient`
 * (`@/lib/booking-links/public-client`), never the shared authenticated
 * client, so no logged-in visitor's `Authorization` / `X-Organization-Id`
 * leaks onto a surface that is supposed to be reachable by a code alone.
 *
 * This calls `publicBookingCalendarBookableSlotsList` directly (not the
 * generated `publicBookingCalendarBookableSlotsListOptions` factory from
 * `@tanstack/react-query.gen`) because that factory hardcodes
 * `throwOnError: true`, which throws only the parsed error BODY and drops
 * the `Response` — and `parseReadFailure` (the opaque-403 mapper this whole
 * read path depends on) needs the `Response`, not the body. See
 * `use-appointment-type-availability-preview.ts` for the same "call the raw sdk
 * function from a custom queryFn" precedent, for an unrelated reason
 * (no generated `*Options` factory exists for a POST-shaped operation).
 *
 * LOAD-BEARING: never read `duration_seconds` back off this hook's result to
 * decide what to render — a pinned appointment type duration silently overrides the
 * requested value with no error (see the plan's "Read the duration off the
 * proposals, never off local state" guiding decision). Callers must render
 * the length of each returned `BookableSlotProposal` (`end_time - start_time`),
 * never the `durationSeconds` they asked for.
 */

import { useQuery } from '@tanstack/react-query';
import { publicBookingCalendarBookableSlotsList } from '@/client/sdk.gen';
import type { BookableSlotProposal } from '@/client';
import { publicBookingClient } from '@/lib/booking-links/public-client';
import {
  parseReadFailure,
  PublicReadFailureError,
} from '@/lib/booking-links/errors';

export const PUBLIC_BOOKABLE_SLOTS_QUERY_KEY = [
  'public-bookable-slots',
] as const;

export interface UsePublicBookableSlotsParams {
  /** Plaintext booking code from the URL — sent as `X-Booking-Code`. */
  code: string;
  /**
   * Desired event duration in seconds, read from the page's `?duration=`
   * query param. Only affects the REQUEST — see the module doc comment for
   * why the rendered duration must come from the response instead.
   */
  durationSeconds: number;
  /** ISO 8601 start of the search window. */
  searchWindowStart: string;
  /** ISO 8601 end of the search window. */
  searchWindowEnd: string;
  /** Search step in seconds; omitted lets the backend default (900s). */
  slotStepSeconds?: number;
  /** Set false to hold off (e.g. while `durationSeconds` isn't valid yet). */
  enabled?: boolean;
}

export function usePublicBookableSlots({
  code,
  durationSeconds,
  searchWindowStart,
  searchWindowEnd,
  slotStepSeconds,
  enabled = true,
}: UsePublicBookableSlotsParams) {
  return useQuery<BookableSlotProposal[], PublicReadFailureError>({
    queryKey: [
      ...PUBLIC_BOOKABLE_SLOTS_QUERY_KEY,
      {
        code,
        durationSeconds,
        searchWindowStart,
        searchWindowEnd,
        slotStepSeconds,
      },
    ],
    enabled: enabled && code.length > 0,
    // A `link-invalid` / `range-invalid` result is not transient — retrying
    // it just repeats the same opaque 403/400. Fail once; the UI decides
    // what to render from `.state`.
    retry: false,
    queryFn: async () => {
      const { data, response } = await publicBookingCalendarBookableSlotsList({
        client: publicBookingClient,
        headers: { 'X-Booking-Code': code },
        query: {
          duration_seconds: durationSeconds,
          search_window_start: searchWindowStart,
          search_window_end: searchWindowEnd,
          ...(slotStepSeconds !== undefined
            ? { slot_step_seconds: slotStepSeconds }
            : {}),
        },
      });

      if (response && response.ok && data !== undefined) {
        return data;
      }

      // `response` is undefined only when the request never reached the
      // server (network failure) or blew up building the request itself —
      // neither says anything about the code, so it maps to the generic
      // 'error' state rather than 'link-invalid'. The `=== 'ok'` fallback
      // covers the (should-be-impossible) case of an ok response with no
      // data — never construct the error with the success state.
      const state = response ? parseReadFailure(response) : 'error';
      throw new PublicReadFailureError(state === 'ok' ? 'error' : state);
    },
  });
}
