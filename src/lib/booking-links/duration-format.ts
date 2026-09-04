/**
 * duration-format.ts — the one place `CalendarGroup.duration`'s two wire
 * representations meet.
 *
 * Every other duration in this domain (slot reads, the mint dialog's
 * advisory calendar duration, the GraphQL mutations) speaks whole seconds.
 * `CalendarGroup.duration` does not: it is a DRF `DurationField`, serialized
 * with Django's `duration_string()`, which folds any day component into
 * hours rather than emitting a separate `D ` prefix — so a 25-hour value
 * comes back as `"25:00:00"`, never `"1 01:00:00"`. The public-scheduling
 * settings form edits a plain number of minutes, so this module is the only
 * place that crosses between "minutes a human typed" and that wire string.
 *
 * Parsing is intentionally more liberal than what we ever emit: DRF's
 * `DurationField.to_internal_value` (via Django's `parse_duration`) also
 * accepts an explicit `"D day[s], HH:MM:SS"` prefix and fractional seconds
 * on the way IN, so `djangoDurationToMinutes` tolerates that shape too,
 * even though `minutesToDjangoDuration` never produces it — a value this
 * form would send is always well inside a day.
 */

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

// Optional "<n> day(s), " / "<n> " prefix, then either "MM:SS" or
// "HH:MM:SS" (any number of digits per field), then optional
// ".<fractional seconds>" — a relaxed superset of both Django's
// `duration_string()` output and `parse_duration()`'s accepted input.
const DURATION_STRING_PATTERN =
  /^(?:(\d+)\s*(?:days?,?)?\s+)?(\d+):(\d{1,2})(?::(\d{1,2}))?(?:\.\d+)?$/;

/**
 * Parses a Django `DurationField` string (or `undefined`/`null`/empty,
 * meaning "unset") into whole minutes, rounding to the nearest minute.
 * Anything unparsable reads as `0`, the same "no length set" value as an
 * absent field — this form never needs to distinguish "unset" from
 * "malformed", both are treated the same way as "nothing to show". The
 * return value stays `0` rather than surfacing the distinction (e.g. via
 * `NaN` or a thrown error) because `groupDurationIsUnset` relies on this
 * same conversion to decide whether to show the grandfathered-duration
 * warning — a corrupted value from the API must still read as "unset"
 * there, not as a false "healthy" state. A `console.warn` below keeps a
 * genuinely malformed value distinguishable from a legitimately absent one
 * without changing that behavior.
 */
export function djangoDurationToMinutes(
  duration: string | null | undefined
): number {
  if (!duration) return 0;
  const match = DURATION_STRING_PATTERN.exec(duration.trim());
  if (!match) {
    console.warn(
      `djangoDurationToMinutes: unparsable duration string ${JSON.stringify(duration)}, treating as unset`
    );
    return 0;
  }

  const [, daysPart, firstField, secondField, thirdField] = match;
  const days = daysPart ? Number(daysPart) : 0;

  // With three colon-separated fields present, it's HH:MM:SS. With only
  // two, Django's liberal parse grammar treats it as MM:SS (no hours) —
  // our own output always has all three, but input may not.
  const hours = thirdField !== undefined ? Number(firstField) : 0;
  const minutes =
    thirdField !== undefined ? Number(secondField) : Number(firstField);
  const seconds =
    thirdField !== undefined ? Number(thirdField) : Number(secondField);

  const totalSeconds =
    days * SECONDS_PER_DAY +
    hours * SECONDS_PER_HOUR +
    minutes * SECONDS_PER_MINUTE +
    seconds;
  return Math.round(totalSeconds / SECONDS_PER_MINUTE);
}

/**
 * Formats whole minutes as the `"HH:MM:SS"` string `CalendarGroupSerializer`
 * expects on write — zero-padded to at least two digits per field, matching
 * Django's own `duration_string()` output exactly (so a value this function
 * writes and a value the server later returns compare equal as strings, not
 * just as parsed minutes). Negative input clamps to `0`.
 */
export function minutesToDjangoDuration(minutes: number): string {
  const totalMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(remainingMinutes)}:00`;
}

/**
 * True when a group's `duration` cannot back a public booking: absent,
 * empty, or every numeric component is zero (e.g. `"0:00:00"`). Consolidates
 * the minimal predicate `mint-booking-link-dialog.tsx` carried since Phase 3
 * (`groupDurationIsUnset`) — that stub deliberately did not grow into a full
 * parser and named this module as its eventual replacement.
 */
export function groupDurationIsUnset(
  duration: string | null | undefined
): boolean {
  return djangoDurationToMinutes(duration) <= 0;
}
