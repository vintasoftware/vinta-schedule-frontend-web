/**
 * An appointment-type-scoped bookable-slots read requires a `duration_seconds` param,
 * but an appointment type `book` or `reschedule` link carries no `?duration=` at all —
 * the appointment type's own `AppointmentType.duration` is server-pinned (see
 * `build-url.ts`'s "Appointment Type duration comes from the server" guiding
 * decision). This placeholder only shapes the REQUEST when the appointment type has no
 * pinned duration; it is silently overridden otherwise, and every consumer
 * always renders each returned proposal's own length rather than this
 * value. Shared by `public-appointment-type-booking-flow.tsx` and `reschedule-flow.tsx`
 * so the two stay in sync by the compiler, not by convention.
 */
export const APPOINTMENT_TYPE_SLOTS_READ_DURATION_PLACEHOLDER_SECONDS = 1800;
