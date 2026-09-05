/**
 * group-payload.ts — the one place a `CalendarGroup` write body is built.
 *
 * **`PATCH /calendar-groups/{id}/` is only partial for two of its fields.**
 * `CalendarGroupSerializer` reads the rest of the body as a whole-object
 * replacement, so a caller that sends "just the field I changed" corrupts the
 * group:
 *
 *   - `slots` **must** be present. It has no omitted-means-unchanged sentinel —
 *     a write always replaces the full slot list. The server rejects a partial
 *     update that omits it (400, `{"slots": "This field cannot be omitted…"}`)
 *     precisely because reading the absence as "no slots" would delete every
 *     slot and every pool attachment with it. Each slot must carry its own full
 *     `calendar_ids`, for the same reason.
 *   - `name` must be present — the serializer reads it unguarded.
 *   - `description` must be present, or it is **silently cleared**: the
 *     serializer defaults it to `""` rather than leaving it alone.
 *   - `duration` and `accepts_public_scheduling` are the two genuinely
 *     tri-state fields: omitted means unchanged, and an explicit `null` is a
 *     validation error. So they are included here only when actually changing.
 *
 * `buildGroupUpdateBody` takes the group as last read plus the fields being
 * changed, and returns a body that satisfies all of that. Every caller that
 * PATCHes a group should go through it rather than hand-assembling a body.
 */

import type {
  Calendar,
  CalendarGroup,
  CalendarGroupSlot,
  CalendarGroupSlotWritable,
  CalendarPool,
  PatchedCalendarGroupWritable,
} from '@/client';

// ---------------------------------------------------------------------------
// Roster resolution
// ---------------------------------------------------------------------------

/** Pool id → the calendar ids on that pool's roster. */
export type PoolRosters = ReadonlyMap<number, readonly number[]>;

export function buildPoolRosters(pools: readonly CalendarPool[]): PoolRosters {
  return new Map(pools.map((p) => [p.id, p.calendars.map((c) => c.id)]));
}

/**
 * The calendars a slot actually offers: its individual picks plus every
 * attached pool's roster, deduplicated. A pool id with no entry in `rosters`
 * contributes nothing — that happens only while the pool list is still
 * loading, and the group form blocks submit until it has resolved.
 */
export function effectiveRoster(
  calendarIds: readonly number[],
  poolIds: readonly number[],
  rosters: PoolRosters
): number[] {
  const union = new Set<number>(calendarIds);
  for (const poolId of poolIds) {
    for (const calendarId of rosters.get(poolId) ?? []) {
      union.add(calendarId);
    }
  }
  return [...union];
}

/**
 * Splits a saved slot's roster back into the two halves a write needs.
 *
 * The API reports a slot's roster as one flat `calendars` list with no marker
 * for where each calendar came from, so "individual" is derived by subtracting
 * the attached pools' rosters. Writing the flat list back as `calendar_ids`
 * would be wrong in a way that survives: every pool calendar would also become
 * an inline member, and detaching the pool later would no longer remove it.
 *
 * The one thing this cannot preserve: a calendar that is BOTH an individual
 * pick and a pool member round-trips as pool-only. The roster is identical
 * either way, so nothing looks wrong until the pool is detached — at which
 * point the calendar leaves the slot where before it would have stayed. The
 * API has no way to express the distinction on read, so no caller can.
 */
export function splitSavedSlotRoster(
  calendars: readonly Calendar[],
  pools: readonly CalendarPool[]
): { calendar_ids: number[]; pool_ids: number[] } {
  const fromPools = new Set(pools.flatMap((p) => p.calendars.map((c) => c.id)));
  return {
    calendar_ids: calendars.map((c) => c.id).filter((id) => !fromPools.has(id)),
    pool_ids: pools.map((p) => p.id),
  };
}

/**
 * A saved slot as the writable shape that reproduces it exactly: same name,
 * order, required count, description, inline roster and pool attachments.
 */
export function savedSlotToWritable(
  slot: CalendarGroupSlot,
  index: number
): CalendarGroupSlotWritable {
  return {
    name: slot.name,
    description: slot.description ?? '',
    order: slot.order ?? index,
    required_count: slot.required_count ?? 1,
    ...splitSavedSlotRoster(slot.calendars, slot.pools),
  };
}

/** Every slot of a saved group, as the writable list that reproduces it. */
export function savedSlotsToWritable(
  group: CalendarGroup
): CalendarGroupSlotWritable[] {
  return group.slots.map(savedSlotToWritable);
}

// ---------------------------------------------------------------------------
// buildGroupUpdateBody
// ---------------------------------------------------------------------------

/**
 * The fields a caller may change. Anything omitted here keeps the group's
 * current value — which, for everything except `duration` and
 * `accepts_public_scheduling`, means resending it rather than leaving it out
 * of the request. See this module's header for why.
 */
export interface GroupUpdateChanges {
  name?: string;
  description?: string;
  slots?: CalendarGroupSlotWritable[];
  duration?: string;
  accepts_public_scheduling?: boolean;
}

/**
 * Builds a complete `PATCH /calendar-groups/{id}/` body from the group as last
 * read plus the fields being changed.
 *
 * `name`, `description` and `slots` are always present — carried over from
 * `group` when the caller isn't changing them. `duration` and
 * `accepts_public_scheduling` appear only when the caller passes them, so a
 * write that isn't about public scheduling leaves both untouched.
 */
export function buildGroupUpdateBody(
  group: CalendarGroup,
  changes: GroupUpdateChanges = {}
): PatchedCalendarGroupWritable {
  const body: PatchedCalendarGroupWritable = {
    name: changes.name ?? group.name,
    description: changes.description ?? group.description ?? '',
    slots: changes.slots ?? savedSlotsToWritable(group),
  };

  // Tri-state: present only when actually changing. An explicit `null` is a
  // validation error server-side, so there is no way to clear either field.
  if (changes.duration !== undefined) {
    body.duration = changes.duration;
  }
  if (changes.accepts_public_scheduling !== undefined) {
    body.accepts_public_scheduling = changes.accepts_public_scheduling;
  }

  return body;
}
