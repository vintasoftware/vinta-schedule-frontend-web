/**
 * A group-scoped bookable-slots read requires a `duration_seconds` param,
 * but a group `book` or `reschedule` link carries no `?duration=` at all —
 * the group's own `CalendarGroup.duration` is server-pinned (see
 * `build-url.ts`'s "Group duration comes from the server" guiding
 * decision). This placeholder only shapes the REQUEST when the group has no
 * pinned duration; it is silently overridden otherwise, and every consumer
 * always renders each returned proposal's own length rather than this
 * value. Shared by `public-group-booking-flow.tsx` and `reschedule-flow.tsx`
 * so the two stay in sync by the compiler, not by convention.
 */
export const GROUP_SLOTS_READ_DURATION_PLACEHOLDER_SECONDS = 1800;
