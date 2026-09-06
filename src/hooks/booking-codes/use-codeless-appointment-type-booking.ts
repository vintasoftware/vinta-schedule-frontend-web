/**
 * Public, CODELESS appointment-type booking operations — the reusable-link
 * analogue of `use-public-appointment-type-booking.ts` (Phase 3's code-gated appointment type
 * flow). Bundled in one file for the same reason as that module: a
 * whole-appointment-type time-proposal read, then a per-range per-slot availability
 * read, then the write, always driven in lockstep by one flow
 * (`codeless-appointment-type-booking-flow.tsx`).
 *
 * The appointment type is addressed by its `public_booking_slug` in the PATH, not by an
 * `X-Booking-Code` header — there is no code on this surface at all. That
 * absence is exactly what selects the codeless branch on the write endpoint
 * (`publicBookingAppointmentTypesEventsCreate`'s `X-Booking-Code` header is
 * OPTIONAL there specifically so a public appointment type can be booked with none —
 * see that endpoint's doc comment in `@/client/sdk.gen`). This hook never
 * sends that header, by construction: none of the calls below has a
 * `headers` option at all.
 *
 * DURATION: none of these three endpoints takes `duration_seconds` — the
 * codeless reads resolve the appointment type's own pinned `AppointmentType.duration`
 * server-side (`_resolve_public_group_duration`), and the write derives its
 * span from the proposal the attendee picked. So, unlike Phase 3's coded
 * appointment type flow, there is no `APPOINTMENT_TYPE_SLOTS_READ_DURATION_PLACEHOLDER_SECONDS`
 * handling here at all — there is no required param to placate.
 *
 * ERRORS — READS use `parseCodelessAppointmentTypeReadFailure` /
 * `CodelessAppointmentTypeReadFailureError` (`@/lib/booking-links/
 * codeless-appointment-type-read-errors`), NEVER `parseReadFailure` /
 * `PublicReadFailureError`. See that module's doc comment for why the two
 * must stay separate: an unknown slug is a real, distinct 404 here, not the
 * same opaque state as a real-but-non-public appointment type's 403. The WRITE still
 * uses `parseWriteFailure` / `PublicWriteFailureError` — the real
 * `{error_code, detail}` vocabulary is unchanged by the absence of a code
 * (only `SLOT_UNAVAILABLE` is recoverable there, same as every other public
 * write).
 *
 * Every call goes through `publicBookingClient` (no `Authorization` /
 * `X-Organization-Id`) and calls the raw `@/client/sdk.gen` functions
 * directly, not the generated `*Options`/`*Mutation` factories — same
 * `throwOnError: true` problem documented in `use-public-bookable-slots.ts`.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  publicBookingAppointmentTypesBookableSlotsList,
  publicBookingAppointmentTypesAvailabilityCreate,
  publicBookingAppointmentTypesEventsCreate,
} from '@/client/sdk.gen';
import type {
  BookableSlotProposal,
  BookingCodeAppointmentTypeEventCreate,
  CalendarEventWithManagementCodes,
  AppointmentTypeRangeAvailability,
} from '@/client';
import { publicBookingClient } from '@/lib/booking-links/public-client';
import {
  parseCodelessAppointmentTypeReadFailure,
  CodelessAppointmentTypeReadFailureError,
} from '@/lib/booking-links/codeless-appointment-type-read-errors';
import {
  parseWriteFailure,
  PublicWriteFailureError,
} from '@/lib/booking-links/errors';

export const CODELESS_APPOINTMENT_TYPE_BOOKABLE_SLOTS_QUERY_KEY = [
  'codeless-appointment-type-bookable-slots',
] as const;

export interface UseCodelessAppointmentTypeBookableSlotsParams {
  /** The appointment type's opaque, globally-unique `public_booking_slug`. */
  publicSlug: string;
  /** ISO 8601 start of the search window. */
  searchWindowStart: string;
  /** ISO 8601 end of the search window. */
  searchWindowEnd: string;
  /** Search step in seconds; omitted lets the backend default (900s). */
  slotStepSeconds?: number;
  /** Set false to hold off (e.g. while inputs aren't valid yet). */
  enabled?: boolean;
}

export function useCodelessAppointmentTypeBookableSlots({
  publicSlug,
  searchWindowStart,
  searchWindowEnd,
  slotStepSeconds,
  enabled = true,
}: UseCodelessAppointmentTypeBookableSlotsParams) {
  return useQuery<
    BookableSlotProposal[],
    CodelessAppointmentTypeReadFailureError
  >({
    queryKey: [
      ...CODELESS_APPOINTMENT_TYPE_BOOKABLE_SLOTS_QUERY_KEY,
      { publicSlug, searchWindowStart, searchWindowEnd, slotStepSeconds },
    ],
    enabled: enabled && publicSlug.length > 0,
    // A 'not-found' / 'unavailable' result is not transient — retrying it
    // just repeats the same 404/403. Fail once; the UI decides what to
    // render from `.state`.
    retry: false,
    queryFn: async () => {
      const { data, response } =
        await publicBookingAppointmentTypesBookableSlotsList({
          client: publicBookingClient,
          path: { public_slug: publicSlug },
          query: {
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

      const state = response
        ? parseCodelessAppointmentTypeReadFailure(response)
        : 'error';
      throw new CodelessAppointmentTypeReadFailureError(
        state === 'ok' ? 'error' : state
      );
    },
  });
}

export interface FetchCodelessAppointmentTypeSlotAvailabilityParams {
  /** The appointment type's opaque, globally-unique `public_booking_slug`. */
  publicSlug: string;
  /** ISO 8601 start of the chosen proposal's range. */
  startTime: string;
  /** ISO 8601 end of the chosen proposal's range. */
  endTime: string;
}

/**
 * Fetch per-slot free-candidate availability for ONE range — called
 * imperatively once the attendee picks a whole-appointment-type time proposal. Mirrors
 * `fetchPublicAppointmentTypeSlotAvailability`'s shape and its defensive
 * `results.find(...)` fallback for a normalized-echo mismatch, but against
 * the codeless, slug-addressed endpoint and this module's own error mapping.
 */
export async function fetchCodelessAppointmentTypeSlotAvailability({
  publicSlug,
  startTime,
  endTime,
}: FetchCodelessAppointmentTypeSlotAvailabilityParams): Promise<
  AppointmentTypeRangeAvailability | undefined
> {
  const { data, response } =
    await publicBookingAppointmentTypesAvailabilityCreate({
      client: publicBookingClient,
      path: { public_slug: publicSlug },
      body: { ranges: [{ start_time: startTime, end_time: endTime }] },
    });

  if (response && response.ok && data !== undefined) {
    const results = data.results ?? [];
    return (
      results.find(
        (r) => r.start_time === startTime && r.end_time === endTime
      ) ?? results[0]
    );
  }

  const state = response
    ? parseCodelessAppointmentTypeReadFailure(response)
    : 'error';
  throw new CodelessAppointmentTypeReadFailureError(
    state === 'ok' ? 'error' : state
  );
}

export interface CodelessBookAppointmentTypeEventParams {
  /** The appointment type's opaque, globally-unique `public_booking_slug`. */
  publicSlug: string;
  body: BookingCodeAppointmentTypeEventCreate;
}

/**
 * SECURITY (Phase 5, ported): same `gcTime: 0` no-persistence discipline as
 * `usePublicAppointmentTypeBookEvent` — the `201` here also carries
 * `management.reschedule_code` / `management.cancel_code`
 * (`CalendarEventWithManagementCodes`), minted by the same viewset
 * regardless of whether the booking that produced it was coded or codeless.
 * See `use-public-book-event.ts`'s doc comment for the full mechanics.
 *
 * NO `X-Booking-Code` HEADER, EVER: this is what selects the codeless branch
 * server-side. Do not add a `headers` option to this call under any
 * circumstance — a public appointment type link must never carry a code.
 */
export function useCodelessAppointmentTypeBookEvent() {
  const bookAppointmentTypeEventMutation = useMutation<
    CalendarEventWithManagementCodes,
    PublicWriteFailureError,
    CodelessBookAppointmentTypeEventParams
  >({
    // A retried write after the server already committed a create would
    // create a duplicate booking; fail once and let the caller decide.
    retry: false,
    gcTime: 0,
    mutationFn: async ({ publicSlug, body }) => {
      const { data, error, response } =
        await publicBookingAppointmentTypesEventsCreate({
          client: publicBookingClient,
          path: { public_slug: publicSlug },
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

  const bookAppointmentTypeEvent = async (
    params: CodelessBookAppointmentTypeEventParams
  ): Promise<CalendarEventWithManagementCodes> =>
    bookAppointmentTypeEventMutation.mutateAsync(params);

  return { bookAppointmentTypeEvent, bookAppointmentTypeEventMutation };
}
