/**
 * Luxon-based date/timezone utilities.
 *
 * All helpers operate on IANA timezone names so events always render in their
 * stored zone — DST transitions are handled by Luxon's explicit DateTime/zone
 * model rather than the ambiguous local-offset math in the native Date API.
 */

import { DateTime, Duration, Interval, Settings } from 'luxon';

export { DateTime, Duration, Interval, Settings };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The calendar view modes supported by eventRange. */
export type CalendarView = 'list' | 'month' | 'week';

/**
 * A start/end range expressed as Luxon DateTimes in a specific IANA zone.
 * Both boundaries are inclusive (use .plus({milliseconds:-1}) on end when
 * passing to APIs that expect exclusive upper bounds).
 */
export interface DateRange {
  start: DateTime;
  end: DateTime;
}

/**
 * Query params for list endpoints — ISO strings with timezone offset baked in,
 * so the backend sees exact moments regardless of where the request originates.
 */
export interface ApiRange {
  start: string;
  end: string;
}

/**
 * A single weekday row used in weekly-pattern availability editors.
 * `index` matches Python/ISO weekday conventions: 0 = Monday … 6 = Sunday.
 */
export interface WeekdayEntry {
  index: number;
  /** Short label, e.g. "Mon" */
  short: string;
  /** Full label, e.g. "Monday" */
  label: string;
  /** ISO 8601 byday codes e.g. "MO", "TU" — used in RRULE byday fields */
  byday: string;
}

// ---------------------------------------------------------------------------
// RFC-5545 recurrence rule (subset)
// ---------------------------------------------------------------------------

export type RRuleFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/**
 * RFC-5545 RRULE subset used in booking forms.
 * Only the fields the booking API surface requires are included; extensions
 * can be added here without touching the serialisation layer (serializeRRule
 * writes only defined fields).
 */
export interface RecurrenceRule {
  freq: RRuleFreq;
  interval?: number;
  /** ISO 8601 date string or full datetime — e.g. "2025-12-31" */
  until?: string;
  count?: number;
  /** Array of RFC-5545 day codes: "MO", "TU", "WE", "TH", "FR", "SA", "SU" */
  byday?: string[];
}

// ---------------------------------------------------------------------------
// Zone-aware formatting
// ---------------------------------------------------------------------------

/**
 * Format an ISO timestamp in a specific IANA timezone.
 *
 * @param iso   - ISO 8601 datetime string (with or without offset).
 * @param zone  - IANA timezone name, e.g. "America/New_York".
 * @param fmt   - Luxon format token string, e.g. "yyyy-MM-dd HH:mm".
 *                Defaults to a human-friendly locale representation
 *                ("MMM d, yyyy, h:mm a ZZZZ") that includes the
 *                abbreviated zone name so mixed-zone lists are unambiguous.
 *
 * @returns Formatted string, or an empty string when iso is falsy/invalid.
 */
export function zonedFormat(
  iso: string | null | undefined,
  zone: string,
  fmt: string = 'MMM d, yyyy, h:mm a ZZZZ'
): string {
  if (!iso) return '';
  const dt = DateTime.fromISO(iso, { zone });
  if (!dt.isValid) return '';
  return dt.toFormat(fmt);
}

// ---------------------------------------------------------------------------
// Calendar view range
// ---------------------------------------------------------------------------

/**
 * Compute the visible date range for a given view mode around an anchor date.
 *
 * - list  → the 7-day window from anchor day through anchor+6 days (inclusive)
 * - week  → the Monday–Sunday (ISO) week that contains the anchor
 * - month → the full calendar month that contains the anchor, padded to
 *            complete ISO weeks (so the grid has no partial first/last row)
 *
 * All boundaries are computed in `zone` so that DST transitions are
 * respected — a week that crosses a spring-forward boundary has the
 * same calendar start/end even though it is 167 h long rather than 168 h.
 *
 * @param view   - "list" | "week" | "month"
 * @param anchor - Any Luxon DateTime (may be in any zone; only calendar date
 *                 components are used after converting to `zone`).
 * @param zone   - IANA timezone name to compute the range in.
 */
export function eventRange(
  view: CalendarView,
  anchor: DateTime,
  zone: string
): DateRange {
  const local = anchor.setZone(zone).startOf('day');

  switch (view) {
    case 'list': {
      return {
        start: local,
        end: local.plus({ days: 6 }).endOf('day'),
      };
    }
    case 'week': {
      // startOf('week') in Luxon uses ISO-8601 (Monday=1)
      const weekStart = local.startOf('week');
      return {
        start: weekStart,
        end: weekStart.plus({ weeks: 1 }).minus({ milliseconds: 1 }),
      };
    }
    case 'month': {
      const monthStart = local.startOf('month').startOf('week');
      const monthEnd = local.endOf('month').endOf('week');
      return {
        start: monthStart,
        end: monthEnd,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// API query params
// ---------------------------------------------------------------------------

/**
 * Convert a DateRange to timezone-correct ISO strings for list-endpoint
 * query params.  The strings include full UTC offsets so the backend sees
 * the exact moment regardless of server timezone.
 *
 * Example output: { start: "2024-03-10T00:00:00-05:00", end: "2024-03-16T23:59:59.999-05:00" }
 */
export function toApiRange(range: DateRange): ApiRange {
  return {
    start: range.start.toISO()!,
    end: range.end.toISO()!,
  };
}

// ---------------------------------------------------------------------------
// Weekly pattern helper
// ---------------------------------------------------------------------------

/**
 * Returns the 7-day weekday matrix starting from Monday (ISO week order).
 * Used by availability editors and recurrence day-of-week pickers.
 *
 * Index mapping matches Python/ISO: 0 = Monday, …, 6 = Sunday.
 */
export function weekdayMatrix(): WeekdayEntry[] {
  return [
    { index: 0, short: 'Mon', label: 'Monday', byday: 'MO' },
    { index: 1, short: 'Tue', label: 'Tuesday', byday: 'TU' },
    { index: 2, short: 'Wed', label: 'Wednesday', byday: 'WE' },
    { index: 3, short: 'Thu', label: 'Thursday', byday: 'TH' },
    { index: 4, short: 'Fri', label: 'Friday', byday: 'FR' },
    { index: 5, short: 'Sat', label: 'Saturday', byday: 'SA' },
    { index: 6, short: 'Sun', label: 'Sunday', byday: 'SU' },
  ];
}

// ---------------------------------------------------------------------------
// DST boundary helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the given datetime falls within the ambiguous hour of a
 * DST fall-back transition (the hour that is repeated when clocks go back).
 *
 * This is useful for surfacing a disambiguation UI: e.g., "Did you mean
 * 1:30 AM EDT or 1:30 AM EST?"
 *
 * Detection: a fall-back makes the UTC offset more negative (smaller). For
 * America/New_York: EDT = -240 min, EST = -300 min. For 01:30 EST (the second
 * occurrence, offset -300), `earlier` resolves to 00:30 EDT (-240 min) because
 * the 00:30 hour did not repeat — so `dt.offset (-300) < earlier.offset (-240)`
 * is `true`. For 01:30 EDT (the first occurrence, offset -240), `earlier` is
 * 00:30 EDT (-240 min), offsets are equal, → `false`.
 */
export function isInDstFallBack(dt: DateTime): boolean {
  // If the current offset is smaller than the offset one hour ago, we have
  // crossed (or are within) the fall-back window.
  const earlier = dt.minus({ hours: 1 });
  return dt.offset < earlier.offset;
}

/**
 * Returns true if the given datetime is in the gap that is skipped during a
 * DST spring-forward transition (the hour that does not exist).
 *
 * Luxon resolves spring-forward gaps by pushing the DateTime forward, so
 * `dt.hour` will differ from the requested hour when the requested moment
 * does not exist in the zone.
 */
export function isInDstSpringForwardGap(dt: DateTime): boolean {
  if (!dt.isValid) return false;
  // If the offset one hour later is larger (numerically greater = further
  // ahead of UTC), a spring-forward already happened, meaning the instant
  // just before was a gap candidate. We detect it by checking whether
  // Luxon normalised the DateTime (it will have moved forward).
  const oneHourLater = dt.plus({ hours: 1 });
  return oneHourLater.offset > dt.offset;
}

/**
 * Returns a human-readable DST status for a given instant in a zone.
 * Useful for per-event timezone labels in mixed-zone lists.
 *
 * Returns "DST" when the zone is currently observing daylight saving time,
 * or "Standard" otherwise.
 */
export function dstStatus(dt: DateTime): 'DST' | 'Standard' {
  // Compare this instant's offset with January of the same year (always
  // standard time in the Northern hemisphere; works equally in the Southern
  // hemisphere because we compare relative to self-year).
  const jan = dt.set({ month: 1, day: 15 });
  const jul = dt.set({ month: 7, day: 15 });
  // Fixed-offset zones (UTC, Asia/Kolkata, Pacific/Honolulu, etc.) never
  // observe DST: January and July share the same offset, so the zone is
  // always on standard time.
  if (jan.offset === jul.offset) return 'Standard';
  const maxOffset = Math.max(jan.offset, jul.offset);
  return dt.offset === maxOffset ? 'DST' : 'Standard';
}

// ---------------------------------------------------------------------------
// RecurrenceRule serialisation (RFC-5545 RRULE)
// ---------------------------------------------------------------------------

const BYDAY_VALID = new Set(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);
const FREQ_VALID = new Set<RRuleFreq>(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);

/**
 * Serialise a RecurrenceRule to an RFC-5545 RRULE string.
 *
 * Example output: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR"
 *
 * Rules:
 * - `freq` is always written.
 * - `interval` is omitted when 1 (the RFC-5545 default).
 * - `until` and `count` are mutually exclusive; if both are provided,
 *   `until` takes precedence and `count` is ignored.
 * - `byday` values are upper-cased and validated; invalid codes are dropped.
 */
export function serializeRRule(rule: RecurrenceRule): string {
  if (!FREQ_VALID.has(rule.freq)) {
    throw new Error(`Invalid RRULE FREQ: ${rule.freq}`);
  }

  const parts: string[] = [`FREQ=${rule.freq}`];

  if (rule.interval !== undefined && rule.interval !== 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }

  if (rule.until) {
    // Strip time part if an ISO date-only string was supplied; RFC-5545
    // allows both DATE and DATE-TIME for UNTIL.
    parts.push(`UNTIL=${rule.until.replace(/[-:]/g, '').split('.')[0]}`);
  } else if (rule.count !== undefined) {
    parts.push(`COUNT=${rule.count}`);
  }

  if (rule.byday && rule.byday.length > 0) {
    const validDays = rule.byday
      .map((d) => d.toUpperCase())
      .filter((d) => BYDAY_VALID.has(d));
    if (validDays.length > 0) {
      parts.push(`BYDAY=${validDays.join(',')}`);
    }
  }

  return parts.join(';');
}

/**
 * Parse an RFC-5545 RRULE string back to a RecurrenceRule.
 *
 * Accepts either a bare RRULE value ("FREQ=WEEKLY;…") or a prefixed string
 * ("RRULE:FREQ=WEEKLY;…"). Unknown properties are silently ignored so
 * round-trips through a backend that adds extra fields remain stable.
 *
 * Throws if FREQ is missing or unrecognised.
 */
export function parseRRule(rrule: string): RecurrenceRule {
  const raw = rrule.startsWith('RRULE:') ? rrule.slice(6) : rrule;
  const pairs = raw.split(';').reduce<Record<string, string>>((acc, part) => {
    const eq = part.indexOf('=');
    if (eq !== -1) acc[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
    return acc;
  }, {});

  const freq = pairs['FREQ'] as RRuleFreq | undefined;
  if (!freq || !FREQ_VALID.has(freq)) {
    throw new Error(`RRULE missing or invalid FREQ: ${rrule}`);
  }

  const rule: RecurrenceRule = { freq };

  if (pairs['INTERVAL']) {
    const n = parseInt(pairs['INTERVAL'], 10);
    if (!isNaN(n)) rule.interval = n;
  }

  if (pairs['UNTIL']) {
    // Normalise back to ISO 8601 (YYYYMMDD → YYYY-MM-DD, etc.)
    const raw = pairs['UNTIL'];
    if (raw.length === 8) {
      rule.until = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    } else if (raw.length >= 15) {
      // DATE-TIME e.g. 20241231T120000Z or 20241231T120000
      rule.until = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}${raw.endsWith('Z') ? 'Z' : ''}`;
    } else {
      rule.until = raw;
    }
  } else if (pairs['COUNT']) {
    const n = parseInt(pairs['COUNT'], 10);
    if (!isNaN(n)) rule.count = n;
  }

  if (pairs['BYDAY']) {
    const days = pairs['BYDAY'].split(',').filter((d) => BYDAY_VALID.has(d));
    if (days.length > 0) rule.byday = days;
  }

  return rule;
}
