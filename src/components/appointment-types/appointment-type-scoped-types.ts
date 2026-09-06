/**
 * appointment-type-scoped-types — pure, framework-free view-model for the weekday
 * window grid (Phase 3b). No React import here on purpose: this module
 * holds the highest data-loss-risk logic in the plan (classification and
 * diffing), and keeping it pure makes it directly unit-testable without
 * rendering anything.
 *
 * -----------------------------------------------------------------------
 * THE CLASSIFICATION RULE (read this before touching `classifyWindow`)
 * -----------------------------------------------------------------------
 * A `AppointmentTypeScopedAvailabilityWindow` is representable in the weekday grid
 * ONLY when it is a weekly recurrence naming exactly one weekday --
 * `FREQ=WEEKLY;BYDAY=<one day>` and nothing else. Every other shape is
 * unrepresentable: one-offs (`rrule_string` null), `FREQ=WEEKLY` with
 * multiple `BYDAY` values, any non-weekly frequency, anything carrying
 * `COUNT`, `UNTIL`, `INTERVAL`, or other RRULE parts the grid does not
 * round-trip, and anything that fails to parse.
 *
 * The two failure directions are NOT symmetric:
 *   - A row wrongly classified representable can be rewritten or deleted
 *     by a grid save the admin never intended (silent data loss).
 *   - A row wrongly classified unrepresentable is merely listed read-only
 *     (see unsupported-window-list.tsx) -- annoying, never destructive.
 * `classifyWindow` is written to bias toward "unrepresentable" every time
 * the shape is anything but the one exact pattern above, INCLUDING cases a
 * looser parser would accept (extra RRULE parts a lenient reader would
 * silently ignore, a BYDAY that disagrees with the row's own start-time
 * weekday, a multi-day span, a timezone that differs from the grid's own).
 * See inline comments at each check.
 * -----------------------------------------------------------------------
 */

import { DateTime } from 'luxon';
import type {
  AppointmentTypeScopedAvailabilityWindow,
  AppointmentTypeScopedAvailabilityWindowCreate,
  PatchedAppointmentTypeScopedAvailabilityWindowUpdate,
} from '@/client';
import { serializeRRule, weekdayMatrix } from '@/lib/datetime/index';

// ---------------------------------------------------------------------------
// WeekdayWindow — the grid's row model
// ---------------------------------------------------------------------------

/** RFC-5545 byday codes, in weekdayMatrix() order. */
export type BydayCode = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export interface WeekdayWindow {
  /**
   * Present when this row was loaded from an existing
   * `AppointmentTypeScopedAvailabilityWindow`; absent for a row the editor added and
   * has not saved yet. This is the only thing that distinguishes a create
   * from an update in `computeGridDiff`.
   */
  id?: number;
  weekday: BydayCode;
  /** "HH:mm", local to the window's OWN `timezone` field (see classifyWindow). */
  startTime: string;
  /** "HH:mm", local to the window's OWN `timezone` field. */
  endTime: string;
}

const BYDAY_VALID = new Set<BydayCode>([
  'MO',
  'TU',
  'WE',
  'TH',
  'FR',
  'SA',
  'SU',
]);

/** weekdayMatrix() byday code -> its index (0=Mon..6=Sun), and back. */
export const BYDAY_TO_INDEX: Record<BydayCode, number> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6,
};

const LUXON_WEEKDAY_TO_BYDAY: Record<number, BydayCode> = {
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
  7: 'SU',
};

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export type ClassifiedWindow =
  | { kind: 'representable'; row: WeekdayWindow }
  | {
      kind: 'unrepresentable';
      window: AppointmentTypeScopedAvailabilityWindow;
    };

/**
 * Parses `rrule` (with or without the "RRULE:" prefix) into the single
 * weekday it names, but ONLY if the string is EXACTLY `FREQ=WEEKLY;BYDAY=<one
 * day>` (key order doesn't matter, but no other key may be present).
 *
 * Deliberately does NOT reuse `parseRRule` from lib/datetime: that parser
 * silently ignores any part it doesn't recognize, which is the right
 * behavior for a "round-trip what the backend understands" reader but the
 * WRONG behavior here -- an unrecognized part (WKST, an extension, a typo)
 * must make this row unrepresentable, not silently vanish. Returns null for
 * anything that isn't the one exact shape, or is malformed.
 */
function parseSingleWeekdayRule(rrule: string): BydayCode | null {
  const raw = rrule.startsWith('RRULE:') ? rrule.slice(6) : rrule;
  const parts = raw.split(';').filter((p) => p.length > 0);
  if (parts.length === 0) return null;

  const pairs: Record<string, string> = {};
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) return null; // malformed part (no "=") -- bias unrepresentable
    const key = part.slice(0, eq).toUpperCase();
    if (key in pairs) return null; // duplicate key -- ambiguous, bias unrepresentable
    pairs[key] = part.slice(eq + 1);
  }

  const keys = Object.keys(pairs);
  // Exactly FREQ and BYDAY, nothing else -- rejects COUNT, UNTIL, INTERVAL,
  // WKST, and any other part a looser parser might round-trip or ignore.
  if (keys.length !== 2 || !('FREQ' in pairs) || !('BYDAY' in pairs)) {
    return null;
  }
  if (pairs.FREQ !== 'WEEKLY') return null;

  const days = pairs.BYDAY.split(',');
  if (days.length !== 1) return null; // multi-day BYDAY -- unrepresentable
  const day = days[0].toUpperCase();
  if (!BYDAY_VALID.has(day as BydayCode)) return null;
  return day as BydayCode;
}

/**
 * Classifies one `AppointmentTypeScopedAvailabilityWindow` as either a grid row
 * (`representable`) or a row the grid cannot express (`unrepresentable`).
 * See the module doc comment for the exact rule and why it's biased the
 * way it is.
 */
export function classifyWindow(
  window: AppointmentTypeScopedAvailabilityWindow,
  /**
   * The grid's own timezone (see `defaultGridTimezone`). When provided and
   * this window's `timezone` differs from it, the window is unrepresentable
   * -- two rows rendered in different zones can show the same HH:mm while
   * meaning different instants, with nothing on screen to tell them apart.
   * Undefined (the default) skips this check, e.g. for a caller classifying
   * a single window with no grid context.
   */
  gridTimezone?: string
): ClassifiedWindow {
  if (!window.rrule_string) {
    // One-off (no recurrence at all).
    return { kind: 'unrepresentable', window };
  }

  const byday = parseSingleWeekdayRule(window.rrule_string);
  if (!byday) {
    return { kind: 'unrepresentable', window };
  }

  if (gridTimezone !== undefined && window.timezone !== gridTimezone) {
    return { kind: 'unrepresentable', window };
  }

  const start = DateTime.fromISO(window.start_time, { zone: window.timezone });
  const end = DateTime.fromISO(window.end_time, { zone: window.timezone });
  if (!start.isValid || !end.isValid) {
    return { kind: 'unrepresentable', window };
  }

  const startWeekday = LUXON_WEEKDAY_TO_BYDAY[start.weekday];
  if (startWeekday !== byday) {
    // The RRULE's BYDAY and the row's own start-time weekday disagree. Both
    // this app's own writes and a well-formed integration write keep these
    // aligned; a row where they don't is ambiguous provenance we cannot
    // confidently round-trip through a single "weekday" grid cell -- bias
    // unrepresentable rather than guessing which one is authoritative.
    return { kind: 'unrepresentable', window };
  }

  const startTime = start.toFormat('HH:mm');
  const endTime = end.toFormat('HH:mm');
  // The grid's row is a same-day HH:mm range. A span that crosses a
  // calendar day boundary (overnight, or a whole number of weeks long --
  // `weekday` alone is 1-7 and would wrongly accept the latter) can't
  // round-trip through two same-day time fields -- bias unrepresentable
  // rather than silently truncating or misrepresenting it. Compare calendar
  // days (`hasSame(end, 'day')`), not weekday numbers.
  if (!start.hasSame(end, 'day') || endTime <= startTime) {
    return { kind: 'unrepresentable', window };
  }

  return {
    kind: 'representable',
    row: { id: window.id, weekday: startWeekday, startTime, endTime },
  };
}

export interface ClassifiedWindows {
  representable: WeekdayWindow[];
  unrepresentable: AppointmentTypeScopedAvailabilityWindow[];
}

/**
 * Batch form of `classifyWindow` -- the single source of truth every caller
 * (the grid, the unsupported list) must use, so both always agree on which
 * rows go where. Never call `classifyWindow` ad hoc from a component; call
 * this instead so the two views can't drift apart.
 */
export function classifyWindows(
  windows: readonly AppointmentTypeScopedAvailabilityWindow[]
): ClassifiedWindows {
  // Same "first loaded window's timezone" rule as `defaultGridTimezone`
  // (which additionally falls back to the viewer's zone, irrelevant here
  // since an empty `windows` has nothing to classify against).
  const gridTimezone = windows[0]?.timezone;
  const representable: WeekdayWindow[] = [];
  const unrepresentable: AppointmentTypeScopedAvailabilityWindow[] = [];
  for (const window of windows) {
    const classified = classifyWindow(window, gridTimezone);
    if (classified.kind === 'representable') {
      representable.push(classified.row);
    } else {
      unrepresentable.push(classified.window);
    }
  }
  return { representable, unrepresentable };
}

// ---------------------------------------------------------------------------
// GridDiff
// ---------------------------------------------------------------------------

export interface GridDiffUpdate<T extends WeekdayWindow = WeekdayWindow> {
  id: number;
  row: T;
}

export interface GridDiff<T extends WeekdayWindow = WeekdayWindow> {
  /** Rows in `edited` with no `id` -- never loaded from the server. */
  creates: T[];
  /** Rows present in both, whose weekday/startTime/endTime actually changed. */
  updates: GridDiffUpdate<T>[];
  /**
   * Ids present in `loaded` but absent from `edited`. SAFETY INVARIANT:
   * `loaded` must contain ONLY rows `classifyWindows` marked representable
   * -- an unrepresentable row's id can never appear here, because it can
   * never appear in `loaded` in the first place. See
   * appointment-type-scoped-types.test.ts's "unrepresentable rows can never enter
   * deletes" test, which asserts this end to end (classify -> diff), not
   * merely by construction here.
   */
  deletes: number[];
}

/**
 * Compares the editor's current rows (`edited`) against the rows it was
 * loaded with (`loaded`) and produces the minimal set of creates, updates,
 * and deletes to reconcile the server to the editor's state.
 *
 * An unchanged grid (edited deep-equal to loaded, by id/weekday/startTime/
 * endTime) produces `{ creates: [], updates: [], deletes: [] }` -- the save
 * handler must issue zero requests in that case.
 *
 * Generic over `T` (extends `WeekdayWindow`) so a caller can attach extra,
 * caller-only bookkeeping (e.g. which form field an edited row came from)
 * and get it back untouched in `creates`/`updates[].row` -- this module
 * never needs to know about that bookkeeping.
 */
export function computeGridDiff<T extends WeekdayWindow>(
  loaded: readonly WeekdayWindow[],
  edited: readonly T[]
): GridDiff<T> {
  const creates: T[] = [];
  const updates: GridDiffUpdate<T>[] = [];
  const editedIds = new Set<number>();

  for (const row of edited) {
    if (row.id === undefined) {
      creates.push(row);
      continue;
    }
    editedIds.add(row.id);

    const baseline = loaded.find((b) => b.id === row.id);
    if (!baseline) {
      // An id `loaded` doesn't recognize. Should not happen (every id a
      // grid row carries comes from `loaded` itself) -- if it ever does,
      // failing toward "create" is the safe direction: it never targets an
      // update at an id this diff can't vouch for.
      creates.push(row);
      continue;
    }

    if (
      baseline.weekday !== row.weekday ||
      baseline.startTime !== row.startTime ||
      baseline.endTime !== row.endTime
    ) {
      updates.push({ id: row.id, row });
    }
  }

  const deletes = loaded
    .filter(
      (baseline) => baseline.id !== undefined && !editedIds.has(baseline.id)
    )
    .map((baseline) => baseline.id as number);

  return { creates, updates, deletes };
}

// ---------------------------------------------------------------------------
// Write-payload construction
// ---------------------------------------------------------------------------

// Anchor date is an arbitrary Monday; only the weekday OFFSET from it and
// the HH:mm time matter to the backend (BYDAY drives which weekday the
// window actually recurs on) -- same anchoring strategy as
// availability-editor.tsx's weeklyEntryToWritable.
const ANCHOR_YEAR = 2024;
const ANCHOR_MONTH = 1;
const ANCHOR_DAY = 1; // 2024-01-01 is a Monday.

function anchoredInstant(
  weekday: BydayCode,
  time: string,
  timezone: string
): DateTime {
  const [hour, minute] = time.split(':').map((n) => Number.parseInt(n, 10));
  return DateTime.fromObject(
    {
      year: ANCHOR_YEAR,
      month: ANCHOR_MONTH,
      day: ANCHOR_DAY + BYDAY_TO_INDEX[weekday],
      hour,
      minute,
      second: 0,
      millisecond: 0,
    },
    { zone: timezone }
  );
}

/**
 * `DateTime#toISO()` types as `string | null` -- it returns null only for an
 * invalid DateTime (e.g. an unrecognized timezone). Asserting non-null here
 * would let an invalid zone silently POST `start_time: null` / `end_time:
 * null` to the server; throw instead so the save handler's error path (a
 * toast) surfaces the real problem.
 */
function requireISO(dt: DateTime, label: string): string {
  const iso = dt.toISO();
  if (iso === null) {
    throw new Error(`Could not compute ${label}: invalid timezone`);
  }
  return iso;
}

/**
 * Builds the create payload for a brand-new grid row. `timezone` is the
 * grid's currently-selected timezone -- new rows are always created in it.
 */
export function buildWindowCreateBody(
  row: WeekdayWindow,
  calendarId: number,
  timezone: string
): AppointmentTypeScopedAvailabilityWindowCreate {
  const start = anchoredInstant(row.weekday, row.startTime, timezone);
  const end = anchoredInstant(row.weekday, row.endTime, timezone);
  return {
    calendar: calendarId,
    start_time: requireISO(start, 'start time'),
    end_time: requireISO(end, 'end time'),
    timezone,
    rrule_string: serializeRRule({ freq: 'WEEKLY', byday: [row.weekday] }),
  };
}

/**
 * Builds the PATCH payload for an existing row whose time changed.
 * `timezone` should be the row's OWN original timezone (not necessarily
 * the grid's current selection) so an edit to the wall-clock time doesn't
 * silently also change the row's zone -- the caller is responsible for
 * looking that up from the row it originally loaded. `rrule_string` and
 * `timezone` are omitted from the body: a grid row's weekday never changes
 * without going through a delete+create (see computeGridDiff), so
 * recurrence is left untouched (tri-state "omit"), and the zone is
 * preserved as-is.
 */
export function buildWindowUpdateBody(
  row: WeekdayWindow,
  timezone: string
): PatchedAppointmentTypeScopedAvailabilityWindowUpdate {
  const start = anchoredInstant(row.weekday, row.startTime, timezone);
  const end = anchoredInstant(row.weekday, row.endTime, timezone);
  return {
    start_time: requireISO(start, 'start time'),
    end_time: requireISO(end, 'end time'),
  };
}

/**
 * The grid's default timezone: the first loaded window's own `timezone`
 * (i.e. whatever this calendar's appointment-type-scoped rows are already configured
 * with), falling back to the viewer's own timezone when the calendar has no
 * appointment-type-scoped windows at all yet. `Calendar` carries no timezone field of
 * its own (see the Phase 3b implementer notes), so "the configured
 * calendar's timezone" the spec asks for is read from its own existing
 * rows -- the only place a per-calendar timezone actually lives in this
 * data model.
 */
export function defaultGridTimezone(
  windows: readonly AppointmentTypeScopedAvailabilityWindow[],
  viewerTimezone: string
): string {
  return windows[0]?.timezone ?? viewerTimezone;
}

/** `weekdayMatrix()` re-exported for convenience so callers of this module
 * don't need a second import for the 7-row iteration order. */
export { weekdayMatrix };
