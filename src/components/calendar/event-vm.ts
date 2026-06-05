/**
 * CalendarEventVM — view-model that bridges the API CalendarEvent shape to
 * what react-big-calendar needs.
 *
 * react-big-calendar positions events using JS `Date` objects, but we keep the
 * authoritative start/end as Luxon `DateTime` values locked to each event's
 * stored IANA timezone. This lets us display the per-event zone label correctly
 * even in mixed-zone lists, while the JS Date boundary is just for grid layout.
 *
 * The timezone label is derived at mapping time from the stored `timezone` field
 * and the event's start instant, so DST transitions are captured correctly.
 */

import { DateTime } from 'luxon';
import type {
  CalendarEvent,
  RecurrenceRule as ApiRecurrenceRule,
} from '@/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventStatus =
  | 'confirmed'
  | 'tentative'
  | 'cancelled'
  | 'available'
  | 'booked';

export interface CalendarEventVM {
  /** Unique identifier (stringified API id) */
  id: string;
  /** Display title */
  title: string;
  /**
   * Start instant as a JS Date — used by react-big-calendar for grid layout.
   * Converted from `startDt` at the boundary; the zone information is in
   * `startDt` / `timezone`.
   */
  start: Date;
  /**
   * End instant as a JS Date — used by react-big-calendar for grid layout.
   */
  end: Date;
  /**
   * Start as a Luxon DateTime locked to the event's stored IANA zone.
   * Use this (not `start`) whenever you need zone-aware display.
   */
  startDt: DateTime;
  /**
   * End as a Luxon DateTime locked to the event's stored IANA zone.
   */
  endDt: DateTime;
  /** The event's stored IANA timezone name, e.g. "America/New_York". */
  timezone: string;
  /**
   * Human-readable timezone label at the event's start instant.
   * Includes the abbreviated zone name + offset, e.g. "EDT (UTC-4)" or
   * "EST (UTC-5)". Correct for DST because it is derived from the start
   * instant, not from a static offset.
   */
  timezoneLabel: string;
  /** The calendar (owner) id from the API. */
  calendarId?: number;
  /**
   * Recurrence rule from the API — typed object (not stringified).
   * Use this to inspect or display the rule without lossy serialization.
   */
  recurrenceRule?: ApiRecurrenceRule;
  /** Whether this is a recurring event or instance. */
  isRecurring: boolean;
  /** Whether this is an exception to a recurrence rule. */
  isRecurringException: boolean;
  /** Status derived from the event shape; placeholder for later booking phases. */
  status: EventStatus;
  /** Preserve the original API shape for later actions (edit, cancel…). */
  _raw: CalendarEvent;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a human-readable timezone label for the event's start instant in its
 * own stored zone. Examples:
 *   "EDT (UTC-4)"  — when DST is active in America/New_York
 *   "AEST (UTC+10)" — when no DST in Australia/Sydney
 */
function buildTimezoneLabel(dt: DateTime): string {
  // dt.zoneName gives the IANA name; dt.offsetNameShort gives the abbreviated
  // zone code (e.g. "EDT", "EST", "AEST"). dt.offset is in minutes.
  const abbr = dt.offsetNameShort ?? dt.zoneName ?? 'UTC';
  const offsetMinutes = dt.offset;
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  const offsetStr =
    mins === 0 ? `${hours}` : `${hours}:${String(mins).padStart(2, '0')}`;
  return `${abbr} (UTC${sign}${offsetStr})`;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Map an API `CalendarEvent` to a `CalendarEventVM`.
 *
 * The start/end `DateTime` values are locked to the event's `timezone` field
 * so that DST-crossing events render in their stored zone, not the browser's
 * local zone.
 *
 * For the JS `Date` boundary (react-big-calendar grid positioning): we convert
 * via `.toJSDate()` from the zoned Luxon DateTime, which gives the correct UTC
 * instant regardless of local browser timezone.
 *
 * @param event - Raw API CalendarEvent
 * @param calendarId - Optional calendar id (when available from the endpoint)
 */
export function toCalendarEventVM(
  event: CalendarEvent,
  calendarId?: number
): CalendarEventVM {
  const zone = event.timezone || 'UTC';

  const startDt = DateTime.fromISO(event.start_time, { zone });
  const endDt = DateTime.fromISO(event.end_time, { zone });

  const timezoneLabel = startDt.isValid ? buildTimezoneLabel(startDt) : zone;

  // Derive a simple status. Later phases will enrich this from bookings/attendances.
  const status: EventStatus = 'confirmed';

  return {
    id: String(event.id),
    title: event.title,
    start: startDt.isValid ? startDt.toJSDate() : new Date(event.start_time),
    end: endDt.isValid ? endDt.toJSDate() : new Date(event.end_time),
    startDt,
    endDt,
    timezone: zone,
    timezoneLabel,
    calendarId,
    recurrenceRule: event.recurrence_rule,
    isRecurring: event.is_recurring ?? false,
    isRecurringException: event.is_recurring_exception ?? false,
    status,
    _raw: event,
  };
}

/**
 * Map an array of API CalendarEvents to CalendarEventVMs.
 */
export function toCalendarEventVMs(
  events: CalendarEvent[],
  calendarId?: number
): CalendarEventVM[] {
  return events.map((e) => toCalendarEventVM(e, calendarId));
}
