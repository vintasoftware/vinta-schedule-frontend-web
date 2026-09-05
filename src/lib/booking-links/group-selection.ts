/**
 * Pure, framework-free calendar-group slot-selection helpers.
 *
 * Originally lived inline in `@/hooks/calendar-groups/use-group-booking.ts`
 * (the authenticated group-booking hook). Extracted here in Phase 3 of the
 * public scheduling links plan because importing them from that hook module
 * — even just the two functions this phase actually needs
 * (`isSelectionComplete`, `hasUnsatisfiableSlot`) — pulls its OTHER imports
 * along for the ride into whatever bundle imports them: `@tanstack/react-query`,
 * `@/client/sdk.gen`'s `calendarGroupsBookableSlotsList` /
 * `calendarGroupsAvailabilityCreate` / `calendarGroupsEventsCreate`, and
 * `@/hooks/events/use-calendar-events` (`useCalendarEvents`,
 * `toCalendarEventVMs`, `invalidateCalendarEvents`) — none of which the
 * public booking page has any business shipping to an anonymous visitor.
 *
 * This was verified empirically, not assumed: a throwaway component
 * importing only `isSelectionComplete`/`hasUnsatisfiableSlot` from
 * `use-group-booking.ts` and mounted under `/book/[code]` produced a
 * production build whose route-specific client chunk contained
 * `calendarEventsListQueryKey`, `toCalendarEventVMs`, and
 * `invalidateCalendarEvents` — i.e. Next's production tree-shaking does NOT
 * eliminate `use-group-booking.ts`'s unused exports/imports at this
 * granularity. Moving the pure helpers to a module with zero runtime
 * dependency on the authenticated client removes that drag entirely (the
 * only imports below are `import type` from `@/client`, which are erased at
 * compile time).
 *
 * `use-group-booking.ts` re-exports everything here unchanged, so the
 * authenticated group-booking flow and its existing tests
 * (`@/components/calendar-groups/`, `use-group-booking.test.ts`) see no
 * change in import path or behavior.
 */

import type {
  CalendarGroupRangeAvailability,
  CalendarGroupSlot,
} from '@/client';

/** A slot requires at least 1 calendar; the API default is 1 when unset. */
export function slotRequiredCount(slot: CalendarGroupSlot): number {
  return slot.required_count && slot.required_count > 0
    ? slot.required_count
    : 1;
}

/** Per-slot availability for a single chosen time range. */
export interface SlotAvailability {
  slotId: number;
  /** Calendar ids in the pool that are free for the chosen range. */
  availableCalendarIds: number[];
  /** How many calendars this slot requires (>= 1). */
  requiredCount: number;
  /** True when at least `requiredCount` pool calendars are free. */
  isSatisfiable: boolean;
}

/** A slot the UI can drive: pool + required count + (optional) availability. */
export interface SlotViewModel {
  slotId: number;
  name: string;
  requiredCount: number;
  /** Candidate pool (calendar id + name) the member may pick from. */
  pool: { id: number; name: string }[];
  /**
   * Free calendar ids for the chosen range. `null` before any availability
   * check has run (everything tentatively selectable / unknown).
   */
  availableCalendarIds: number[] | null;
}

/**
 * Map a CalendarGroupRangeAvailability (per-range, per-slot) onto the group's
 * slots, producing a SlotAvailability per slot with its satisfiability flag.
 *
 * A slot the availability response does not mention is treated as having ZERO
 * free calendars (the backend omitting a slot means nothing in its pool is
 * free for that range) → unsatisfiable.
 */
export function buildSlotAvailability(
  slots: CalendarGroupSlot[],
  rangeAvailability: CalendarGroupRangeAvailability | undefined
): SlotAvailability[] {
  const bySlotId = new Map<number, number[]>();
  for (const sa of rangeAvailability?.slots ?? []) {
    bySlotId.set(sa.slot_id, sa.available_calendar_ids);
  }

  return slots.map((slot) => {
    const requiredCount = slotRequiredCount(slot);
    const poolIds = new Set(slot.calendars.map((c) => c.id));
    // Intersect the reported free ids with the slot's pool, defensively.
    const availableCalendarIds = (bySlotId.get(slot.id) ?? []).filter((id) =>
      poolIds.has(id)
    );
    return {
      slotId: slot.id,
      availableCalendarIds,
      requiredCount,
      isSatisfiable: availableCalendarIds.length >= requiredCount,
    };
  });
}

/** True when every slot has enough free calendars to meet its required count. */
export function isSlotSatisfiable(slot: SlotAvailability): boolean {
  return slot.isSatisfiable;
}

/**
 * Validate a draft selection against the slot view models.
 *
 * Returns whether the WHOLE selection is bookable:
 *  - every slot has been checked for availability (availableCalendarIds != null),
 *  - every slot is satisfiable (enough free candidates),
 *  - every slot's selection is exactly `requiredCount` long, and
 *  - every selected calendar is in that slot's free set.
 */
export function isSelectionComplete(
  slots: SlotViewModel[],
  selectionBySlotId: Record<number, number[]>
): boolean {
  if (slots.length === 0) return false;
  return slots.every((slot) => {
    const free = slot.availableCalendarIds;
    if (free === null) return false; // availability not yet known
    if (free.length < slot.requiredCount) return false; // unsatisfiable slot
    const selected = selectionBySlotId[slot.slotId] ?? [];
    if (selected.length !== slot.requiredCount) return false; // wrong count
    return selected.every((id) => free.includes(id)); // only free candidates
  });
}

/** True if ANY slot is unsatisfiable for the chosen range → hard-block submit. */
export function hasUnsatisfiableSlot(slots: SlotViewModel[]): boolean {
  return slots.some(
    (slot) =>
      slot.availableCalendarIds !== null &&
      slot.availableCalendarIds.length < slot.requiredCount
  );
}
