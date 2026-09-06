/**
 * Public, code-gated calendar-APPOINTMENT_TYPE booking operations — the appointment-type-scoped
 * analogue of `use-public-bookable-slots.ts` / `use-public-book-event.ts`.
 *
 * Bundles all three operations an appointment type booking link needs in one file
 * (mirroring the authenticated `useAppointmentTypeBooking` shape), because the phase
 * spec that introduced this hook names them together and they're always
 * driven by the same flow in lockstep — a whole-appointment-type time-proposal read,
 * then a per-range per-slot availability read for whichever proposal the
 * attendee picked, then the write:
 *
 *  - `usePublicAppointmentTypeBookableSlots` — a live `useQuery`, matching
 *    `usePublicBookableSlots`'s shape (loading/error/refetch semantics the
 *    flow's proposal-picking step needs).
 *  - `fetchPublicAppointmentTypeSlotAvailability` — a plain imperative async function,
 *    NOT a hook: it only ever runs once, on demand, right after the
 *    attendee picks a specific proposal — there's no "background query"
 *    shape here to gain from `useQuery`, matching the authenticated
 *    `useAppointmentTypeBooking.fetchSlotAvailability`'s same choice.
 *  - `usePublicAppointmentTypeBookEvent` — a `useMutation`, matching
 *    `usePublicBookEvent`'s shape.
 *
 * Every call goes through `publicBookingClient` (no `Authorization` /
 * `X-Organization-Id`) and calls the raw `@/client/sdk.gen` functions
 * directly rather than the generated `*Options`/`*Mutation` factories —
 * those hardcode `throwOnError: true`, which throws only the parsed error
 * BODY and drops the `Response` that `parseReadFailure`/`parseWriteFailure`
 * need. See `use-public-bookable-slots.ts`'s doc comment for the precedent.
 *
 * READS (`usePublicAppointmentTypeBookableSlots`, `fetchPublicAppointmentTypeSlotAvailability`)
 * collapse every code failure into the opaque `PublicReadFailureError` — the
 * availability POST is documented "repeatable: never consumed by a read",
 * i.e. it's a read despite being a POST, and follows the same opaque-403
 * taxonomy as the GET slots list, never the write vocabulary. The WRITE
 * (`usePublicAppointmentTypeBookEvent`) uses the real `{error_code, detail}`
 * vocabulary via `PublicWriteFailureError`.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  publicBookingAppointmentTypeBookableSlotsList,
  publicBookingAppointmentTypeAvailabilityCreate,
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
  parseReadFailure,
  parseWriteFailure,
  PublicReadFailureError,
  PublicWriteFailureError,
} from '@/lib/booking-links/errors';

export const PUBLIC_APPOINTMENT_TYPE_BOOKABLE_SLOTS_QUERY_KEY = [
  'public-appointment-type-bookable-slots',
] as const;

/**
 * `POST /public/booking/appointment-types/{public_slug}/events/` requires a
 * path segment, but on the CODED branch (this hook always sends
 * `X-Booking-Code`) the server resolves the appointment type from the token and
 * answers `403` on any mismatch — the endpoint's own doc comment calls the
 * path "a routing convenience" for that branch, not the authority. A
 * booking code carries no appointment-type-identifying slug the UI could read even if
 * it wanted to honor the path, so this sends a fixed, meaningless
 * placeholder and never treats the path as authoritative.
 */
const CODED_PUBLIC_SLUG_PLACEHOLDER = 'via-code';

export interface UsePublicAppointmentTypeBookableSlotsParams {
  /** Plaintext booking code from the URL — sent as `X-Booking-Code`. */
  code: string;
  /**
   * Desired event duration in seconds. ALWAYS required by the endpoint, but
   * an appointment-type-scoped link never lets the client choose one — see the caller
   * (`public-appointment-type-booking-flow.tsx`) for the placeholder it sends and why.
   * A pinned `AppointmentType.duration` silently overrides this value with no
   * error; render the length from the returned proposals, never this input.
   */
  durationSeconds: number;
  /** ISO 8601 start of the search window. */
  searchWindowStart: string;
  /** ISO 8601 end of the search window. */
  searchWindowEnd: string;
  /** Search step in seconds; omitted lets the backend default (900s). */
  slotStepSeconds?: number;
  /** Set false to hold off (e.g. while inputs aren't valid yet). */
  enabled?: boolean;
}

export function usePublicAppointmentTypeBookableSlots({
  code,
  durationSeconds,
  searchWindowStart,
  searchWindowEnd,
  slotStepSeconds,
  enabled = true,
}: UsePublicAppointmentTypeBookableSlotsParams) {
  return useQuery<BookableSlotProposal[], PublicReadFailureError>({
    queryKey: [
      ...PUBLIC_APPOINTMENT_TYPE_BOOKABLE_SLOTS_QUERY_KEY,
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
      const { data, response } =
        await publicBookingAppointmentTypeBookableSlotsList({
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

      // `response` undefined only on a network failure / request-build
      // error — says nothing about the code, so it's the generic 'error'
      // state, never 'link-invalid'.
      const state = response ? parseReadFailure(response) : 'error';
      throw new PublicReadFailureError(state === 'ok' ? 'error' : state);
    },
  });
}

export interface FetchPublicAppointmentTypeSlotAvailabilityParams {
  /** Plaintext booking code from the URL — sent as `X-Booking-Code`. */
  code: string;
  /** ISO 8601 start of the chosen proposal's range. */
  startTime: string;
  /** ISO 8601 end of the chosen proposal's range. */
  endTime: string;
}

/**
 * Fetch per-slot free-candidate availability for ONE range — called
 * imperatively once the attendee picks a whole-appointment-type time proposal.
 * Mirrors the authenticated `useAppointmentTypeBooking.fetchSlotAvailability`'s
 * single-range lookup, including the same defensive `results.find(...)`
 * fallback for a normalized-echo mismatch.
 *
 * Throws `PublicReadFailureError` on the same opaque-403 taxonomy as
 * `usePublicAppointmentTypeBookableSlots` — this is a READ (see the module doc
 * comment), never `PublicWriteFailureError`.
 */
export async function fetchPublicAppointmentTypeSlotAvailability({
  code,
  startTime,
  endTime,
}: FetchPublicAppointmentTypeSlotAvailabilityParams): Promise<
  AppointmentTypeRangeAvailability | undefined
> {
  const { data, response } =
    await publicBookingAppointmentTypeAvailabilityCreate({
      client: publicBookingClient,
      headers: { 'X-Booking-Code': code },
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

  const state = response ? parseReadFailure(response) : 'error';
  throw new PublicReadFailureError(state === 'ok' ? 'error' : state);
}

export interface PublicBookAppointmentTypeEventParams {
  /** Plaintext booking code from the URL — sent as `X-Booking-Code`. */
  code: string;
  body: BookingCodeAppointmentTypeEventCreate;
}

/**
 * SECURITY (Phase 5): same `gcTime: 0` no-persistence discipline as
 * `usePublicBookEvent` — the `201` now carries `management.reschedule_code`
 * / `management.cancel_code` (`CalendarEventWithManagementCodes`), and this
 * keeps that response out of the mutation cache beyond the last attached
 * observer rather than the app's default 5-minute mutation `gcTime`. See
 * `use-public-book-event.ts`'s doc comment for the full mechanics.
 */
export function usePublicAppointmentTypeBookEvent() {
  const bookAppointmentTypeEventMutation = useMutation<
    CalendarEventWithManagementCodes,
    PublicWriteFailureError,
    PublicBookAppointmentTypeEventParams
  >({
    // A retried write after the server already committed a create would
    // risk a duplicate booking attempt against a single-use code; fail once
    // and let the caller decide.
    retry: false,
    gcTime: 0,
    mutationFn: async ({ code, body }) => {
      const { data, error, response } =
        await publicBookingAppointmentTypesEventsCreate({
          client: publicBookingClient,
          path: { public_slug: CODED_PUBLIC_SLUG_PLACEHOLDER },
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

  const bookAppointmentTypeEvent = async (
    params: PublicBookAppointmentTypeEventParams
  ): Promise<CalendarEventWithManagementCodes> =>
    bookAppointmentTypeEventMutation.mutateAsync(params);

  return { bookAppointmentTypeEvent, bookAppointmentTypeEventMutation };
}
