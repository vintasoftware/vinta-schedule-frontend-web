/**
 * useGroupBooking — orchestrates booking an event through a Calendar Group.
 *
 * A Calendar Group is a set of named *slots*. Each slot has:
 *  - a `required_count` (how many calendars must be picked for the slot), and
 *  - a candidate *pool* of `calendars` (the M2M the member may choose from).
 * Booking a group event means picking, for EACH slot, exactly `required_count`
 * calendars from its pool — and only ones that are *free* for the chosen time.
 *
 * This hook wraps three group operations and maps the nested API model into a
 * flat, UI-drivable shape:
 *
 *  1. `calendarGroupsBookableSlotsList` — suggests bookable time ranges for a
 *     desired duration within a search window. These are whole-group proposals
 *     (a start/end the group as a whole can satisfy), used to seed the picker.
 *
 *  2. `calendarGroupsAvailabilityCreate` — given one or more [start,end] ranges,
 *     returns per-slot availability: for each range, each slot reports the
 *     subset of its pool calendars that are free (`available_calendar_ids`).
 *     This drives selectability: only free candidates are selectable, and a
 *     slot whose free-candidate count is below its `required_count` is
 *     UNSATISFIABLE (hard-blocks submit — you cannot book an impossible slot).
 *
 *  3. `calendarGroupsEventsCreate` — records the booking. The body carries
 *     `slot_selections: [{ slot_id, calendar_ids }]`, telling the backend which
 *     calendars satisfied which slot. The backend creates the event on the
 *     chosen calendars and blocks the rest of each pool per its own logic.
 *
 * The selectability/satisfiability computation lives in pure helpers
 * (`buildSlotAvailability`, `isSlotSatisfiable`, `isSelectionComplete`) so the
 * component can render and the test can assert without a React context. As
 * of Phase 3 of the public scheduling links plan, those helpers (plus
 * `slotRequiredCount` and `hasUnsatisfiableSlot`) actually LIVE in
 * `@/lib/booking-links/group-selection.ts` — re-exported below unchanged —
 * because the public (unauthenticated) group booking flow needs
 * `isSelectionComplete`/`hasUnsatisfiableSlot` too, and importing them from
 * this file drags this module's authenticated-client imports
 * (`@/hooks/events/use-calendar-events`, the `@/client/sdk.gen` group
 * operations) into the public bundle. See that module's doc comment for how
 * this was verified (a production build of a component importing only those
 * two functions from here pulled `useCalendarEvents`/`toCalendarEventVMs`
 * into the `/book/[code]` route's client chunk).
 */

import { useQueryClient } from '@tanstack/react-query';
import {
  calendarGroupsBookableSlotsList,
  calendarGroupsAvailabilityCreate,
  calendarGroupsEventsCreate,
} from '@/client/sdk.gen';
import type {
  CalendarGroupSlotSelectionInput,
  BookableSlotProposal,
  CalendarGroupRangeAvailability,
  CalendarEvent,
} from '@/client';
import { invalidateCalendarEvents } from '@/hooks/events/use-calendar-events';

export {
  slotRequiredCount,
  buildSlotAvailability,
  isSlotSatisfiable,
  isSelectionComplete,
  hasUnsatisfiableSlot,
  type SlotAvailability,
  type SlotViewModel,
} from '@/lib/booking-links/group-selection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Params for fetching whole-group bookable time suggestions. */
export interface BookableSlotsParams {
  groupId: number;
  /** Desired event duration in seconds. */
  durationSeconds: number;
  /** ISO 8601 start of the search window. */
  searchWindowStart: string;
  /** ISO 8601 end of the search window. */
  searchWindowEnd: string;
}

export interface BookGroupEventParams {
  groupId: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  timezone: string;
  /** Final slot → calendar assignments (one entry per slot). */
  slotSelections: CalendarGroupSlotSelectionInput[];
}

// ---------------------------------------------------------------------------
// useGroupBooking
// ---------------------------------------------------------------------------

export function useGroupBooking() {
  const queryClient = useQueryClient();

  /**
   * Fetch whole-group bookable time suggestions for a desired duration within
   * a search window. Returns the proposal list (start/end ranges the group can
   * accommodate). May be empty.
   */
  const fetchBookableSlots = async (
    params: BookableSlotsParams
  ): Promise<BookableSlotProposal[]> => {
    const { groupId, durationSeconds, searchWindowStart, searchWindowEnd } =
      params;
    const result = await calendarGroupsBookableSlotsList({
      path: { id: String(groupId) },
      query: {
        duration_seconds: durationSeconds,
        search_window_start: searchWindowStart,
        search_window_end: searchWindowEnd,
        limit: 50,
      },
    });
    return result.data?.results ?? [];
  };

  /**
   * Fetch per-slot availability for a single [start,end] range. Returns the
   * CalendarGroupRangeAvailability for that range (or undefined if the backend
   * returned no match), which the caller maps via buildSlotAvailability.
   */
  const fetchSlotAvailability = async (
    groupId: number,
    startTime: string,
    endTime: string
  ): Promise<CalendarGroupRangeAvailability | undefined> => {
    const result = await calendarGroupsAvailabilityCreate({
      path: { id: String(groupId) },
      body: { ranges: [{ start_time: startTime, end_time: endTime }] },
    });
    const results = result.data?.results ?? [];
    // The availability action echoes the queried ranges; match on the range we
    // asked for. Single-range query → the first result is always our range;
    // the fallback guards against normalised-echo mismatches (e.g. trailing Z
    // vs offset-based timestamps) that would cause find() to miss.
    return (
      results.find(
        (r) => r.start_time === startTime && r.end_time === endTime
      ) ?? results[0]
    );
  };

  /**
   * Book the group event. Sends slot_selections (which calendars satisfy which
   * slot); the backend creates the event + blocks the rest of each pool.
   *
   * Throws on backend rejection so the caller can surface the error. On success
   * invalidates the calendar-events queries so views refresh.
   */
  const bookGroupEvent = async (
    params: BookGroupEventParams
  ): Promise<CalendarEvent> => {
    const {
      groupId,
      title,
      description,
      startTime,
      endTime,
      timezone,
      slotSelections,
    } = params;

    const result = await calendarGroupsEventsCreate({
      path: { id: String(groupId) },
      body: {
        title,
        ...(description ? { description } : {}),
        start_time: startTime,
        end_time: endTime,
        timezone,
        slot_selections: slotSelections,
      },
    });

    if (!result.data) {
      throw new Error(
        'Unexpected empty response from calendarGroupsEventsCreate'
      );
    }

    await invalidateCalendarEvents(queryClient);

    return result.data;
  };

  return { fetchBookableSlots, fetchSlotAvailability, bookGroupEvent };
}
