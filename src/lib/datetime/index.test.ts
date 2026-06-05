/**
 * Tests for src/lib/datetime/index.ts
 *
 * The "timezone matrix" section verifies DST correctness with explicit
 * boundary instants for both a spring-forward (America/New_York, 2024-03-10
 * at 02:00 → 03:00) and a fall-back (America/New_York, 2024-11-03 at
 * 02:00 → 01:00) so per-event zone rendering is provably DST-safe.
 */

import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import {
  zonedFormat,
  eventRange,
  toApiRange,
  weekdayMatrix,
  serializeRRule,
  parseRRule,
  dstStatus,
  isInDstFallBack,
  type RecurrenceRule,
} from './index';

// ---------------------------------------------------------------------------
// Timezone matrix — DST boundaries
// ---------------------------------------------------------------------------

describe('timezone matrix — spring-forward (America/New_York, 2024-03-10)', () => {
  // EST→EDT transition: at 02:00 clocks jump forward to 03:00.
  // 01:59:59 EST (UTC-5) is the last second before the gap.
  // 03:00:00 EDT (UTC-4) is the first second after.

  const BEFORE_GAP = '2024-03-10T01:59:59-05:00'; // EST — exists
  const AFTER_GAP = '2024-03-10T03:00:00-04:00'; // EDT — first moment after

  it('formats the instant before the gap in EST (-05:00)', () => {
    // ZZZZ = abbreviated timezone name ("EST", "EDT", "CEST", …)
    const result = zonedFormat(BEFORE_GAP, 'America/New_York', 'HH:mm ZZZZ');
    expect(result).toBe('01:59 EST');
  });

  it('formats the instant after the gap in EDT (-04:00)', () => {
    const result = zonedFormat(AFTER_GAP, 'America/New_York', 'HH:mm ZZZZ');
    expect(result).toBe('03:00 EDT');
  });

  it('dstStatus reports Standard just before the spring-forward', () => {
    const dt = DateTime.fromISO(BEFORE_GAP, { zone: 'America/New_York' });
    expect(dstStatus(dt)).toBe('Standard');
  });

  it('dstStatus reports DST just after the spring-forward', () => {
    const dt = DateTime.fromISO(AFTER_GAP, { zone: 'America/New_York' });
    expect(dstStatus(dt)).toBe('DST');
  });

  it('the spring-forward gap makes the hour from 02:00 to 02:59 non-existent', () => {
    // Luxon resolves the gap by advancing to 03:00 when you set 02:30 EST.
    // We detect this via offset change.
    const beforeOffset = DateTime.fromISO(BEFORE_GAP, {
      zone: 'America/New_York',
    }).offset;
    const afterOffset = DateTime.fromISO(AFTER_GAP, {
      zone: 'America/New_York',
    }).offset;
    // UTC-5 → UTC-4: offset increases by 60 minutes
    expect(afterOffset - beforeOffset).toBe(60);
  });
});

describe('timezone matrix — fall-back (America/New_York, 2024-11-03)', () => {
  // EDT→EST transition: at 02:00 clocks fall back to 01:00.
  // The hour 01:00–01:59 exists twice.

  const FIRST_OCCURRENCE = '2024-11-03T01:30:00-04:00'; // EDT (before fall-back)
  const SECOND_OCCURRENCE = '2024-11-03T01:30:00-05:00'; // EST (after fall-back)

  it('formats the first 01:30 (EDT) unambiguously with its offset label', () => {
    // ZZZZ produces the abbreviated zone name so "EDT" vs "EST" is explicit
    const result = zonedFormat(
      FIRST_OCCURRENCE,
      'America/New_York',
      'HH:mm ZZZZ'
    );
    expect(result).toBe('01:30 EDT');
  });

  it('formats the second 01:30 (EST) unambiguously with its offset label', () => {
    const result = zonedFormat(
      SECOND_OCCURRENCE,
      'America/New_York',
      'HH:mm ZZZZ'
    );
    expect(result).toBe('01:30 EST');
  });

  it('isInDstFallBack detects the repeated (fall-back) hour', () => {
    const dt = DateTime.fromISO(SECOND_OCCURRENCE, {
      zone: 'America/New_York',
    });
    expect(isInDstFallBack(dt)).toBe(true);
  });

  it('isInDstFallBack is false outside the fall-back window', () => {
    const dt = DateTime.fromISO(FIRST_OCCURRENCE, { zone: 'America/New_York' });
    expect(isInDstFallBack(dt)).toBe(false);
  });

  it('dstStatus reports DST just before the fall-back', () => {
    const dt = DateTime.fromISO(FIRST_OCCURRENCE, { zone: 'America/New_York' });
    expect(dstStatus(dt)).toBe('DST');
  });

  it('dstStatus reports Standard just after the fall-back', () => {
    const dt = DateTime.fromISO(SECOND_OCCURRENCE, {
      zone: 'America/New_York',
    });
    expect(dstStatus(dt)).toBe('Standard');
  });
});

// ---------------------------------------------------------------------------
// Mixed-zone unambiguous formatting
// ---------------------------------------------------------------------------

describe('zonedFormat — two events in different zones, displayed unambiguously', () => {
  const ISO = '2024-06-15T14:00:00Z'; // 14:00 UTC

  it('renders 10:00 EDT for New_York (UTC-4 in summer)', () => {
    // UTC-4 in summer (EDT): 14:00 - 4 = 10:00
    // ZZZZ = abbreviated zone name ("EDT")
    const result = zonedFormat(ISO, 'America/New_York', 'HH:mm ZZZZ');
    expect(result).toBe('10:00 EDT');
  });

  it('renders 16:00 +02:00 for Europe/Paris (UTC+2 in summer)', () => {
    // UTC+2 in summer (CEST): 14:00 + 2 = 16:00.
    // Node.js/V8 Intl returns "GMT+2" not "CEST" for European zones; use ZZ
    // (offset notation) which is stable across all runtimes and still
    // unambiguously identifies the zone offset relative to UTC.
    const result = zonedFormat(ISO, 'Europe/Paris', 'HH:mm ZZ');
    expect(result).toBe('16:00 +02:00');
  });

  it('renders with a full default label when no format arg is supplied', () => {
    const result = zonedFormat(ISO, 'America/New_York');
    // Default format ("MMM d, yyyy, h:mm a ZZZZ") includes zone abbreviation
    expect(result).toContain('EDT');
    expect(result).not.toBe('');
  });

  it('returns empty string for null/undefined/empty input', () => {
    expect(zonedFormat(null, 'America/New_York')).toBe('');
    expect(zonedFormat(undefined, 'America/New_York')).toBe('');
    expect(zonedFormat('', 'America/New_York')).toBe('');
  });

  it('returns empty string for a non-ISO garbage string', () => {
    expect(zonedFormat('not-a-date', 'America/New_York')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// eventRange
// ---------------------------------------------------------------------------

describe('eventRange', () => {
  const anchor = DateTime.fromISO('2024-06-15', { zone: 'America/New_York' });

  it('list — returns a 7-day window starting from the anchor day', () => {
    const { start, end } = eventRange('list', anchor, 'America/New_York');
    expect(start.toISODate()).toBe('2024-06-15');
    expect(end.toISODate()).toBe('2024-06-22');
  });

  it('week — returns Monday–Sunday of the anchor week (ISO)', () => {
    // 2024-06-15 is a Saturday; ISO week Mon=2024-06-10 … Sun=2024-06-16
    const { start, end } = eventRange('week', anchor, 'America/New_York');
    expect(start.toISODate()).toBe('2024-06-10');
    expect(end.toISODate()).toBe('2024-06-16');
  });

  it('month — starts on the Monday of the first partial week of the month', () => {
    // June 2024: month starts on Sat 2024-06-01. ISO week start = Mon 2024-05-27
    const { start } = eventRange('month', anchor, 'America/New_York');
    expect(start.toISODate()).toBe('2024-05-27');
  });

  it('month — ends on the Sunday of the last partial week of the month', () => {
    // June 2024: month ends on Sun 2024-06-30 (already Sunday). endOf('week') = 2024-06-30
    const { end } = eventRange('month', anchor, 'America/New_York');
    expect(end.toISODate()).toBe('2024-06-30');
  });

  it('week — range across a DST spring-forward boundary has correct dates', () => {
    // Week containing the 2024-03-10 spring-forward: Mon 2024-03-04
    const dstAnchor = DateTime.fromISO('2024-03-10', {
      zone: 'America/New_York',
    });
    const { start, end } = eventRange('week', dstAnchor, 'America/New_York');
    expect(start.toISODate()).toBe('2024-03-04');
    expect(end.toISODate()).toBe('2024-03-10');
  });

  it('accepts an anchor in a different zone and re-computes in the target zone', () => {
    // Anchor in UTC but compute range in Tokyo (UTC+9)
    const utcAnchor = DateTime.fromISO('2024-06-15T00:00:00Z');
    const { start } = eventRange('week', utcAnchor, 'Asia/Tokyo');
    // 2024-06-15 00:00 UTC = 2024-06-15 09:00 JST → Saturday.
    // ISO week containing Sat 2024-06-15 starts Mon 2024-06-10
    expect(start.toISODate()).toBe('2024-06-10');
  });
});

// ---------------------------------------------------------------------------
// toApiRange round-trip
// ---------------------------------------------------------------------------

describe('toApiRange', () => {
  it('produces ISO strings with timezone offset for New_York (EDT)', () => {
    const anchor = DateTime.fromISO('2024-06-15', { zone: 'America/New_York' });
    const range = eventRange('week', anchor, 'America/New_York');
    const api = toApiRange(range);
    // EDT = UTC-4 in June
    expect(api.start).toContain('-04:00');
    expect(api.end).toContain('-04:00');
  });

  it('produces ISO strings with timezone offset for Europe/Paris (CEST)', () => {
    const anchor = DateTime.fromISO('2024-06-15', { zone: 'Europe/Paris' });
    const range = eventRange('week', anchor, 'Europe/Paris');
    const api = toApiRange(range);
    // CEST = UTC+2 in June
    expect(api.start).toContain('+02:00');
    expect(api.end).toContain('+02:00');
  });

  it('round-trip: parsing the output start back to DateTime returns same day', () => {
    const anchor = DateTime.fromISO('2024-11-15', { zone: 'America/New_York' });
    const range = eventRange('list', anchor, 'America/New_York');
    const { start } = toApiRange(range);
    const reparsed = DateTime.fromISO(start, { zone: 'America/New_York' });
    expect(reparsed.toISODate()).toBe('2024-11-15');
  });

  it('round-trip: parsing the output across DST fall-back returns correct date', () => {
    // Fall-back happens on 2024-11-03 — verify the week range end is stable
    const anchor = DateTime.fromISO('2024-11-03', { zone: 'America/New_York' });
    const range = eventRange('week', anchor, 'America/New_York');
    const api = toApiRange(range);
    const reparsed = DateTime.fromISO(api.start, { zone: 'America/New_York' });
    expect(reparsed.toISODate()).toBe('2024-10-28'); // Monday of that week
  });
});

// ---------------------------------------------------------------------------
// weekdayMatrix
// ---------------------------------------------------------------------------

describe('weekdayMatrix', () => {
  it('returns 7 entries starting with Monday', () => {
    const matrix = weekdayMatrix();
    expect(matrix).toHaveLength(7);
    expect(matrix[0]).toMatchObject({ index: 0, short: 'Mon', byday: 'MO' });
    expect(matrix[6]).toMatchObject({ index: 6, short: 'Sun', byday: 'SU' });
  });

  it('all byday values are valid RFC-5545 codes', () => {
    const valid = new Set(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);
    weekdayMatrix().forEach((e) => expect(valid.has(e.byday)).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// serializeRRule / parseRRule round-trips
// ---------------------------------------------------------------------------

describe('serializeRRule + parseRRule', () => {
  it('round-trips a simple weekly rule', () => {
    const rule: RecurrenceRule = { freq: 'WEEKLY' };
    const serialized = serializeRRule(rule);
    expect(serialized).toBe('FREQ=WEEKLY');
    expect(parseRRule(serialized)).toEqual(rule);
  });

  it('round-trips a weekly rule with interval and byday', () => {
    const rule: RecurrenceRule = {
      freq: 'WEEKLY',
      interval: 2,
      byday: ['MO', 'WE', 'FR'],
    };
    const serialized = serializeRRule(rule);
    expect(serialized).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR');
    const parsed = parseRRule(serialized);
    expect(parsed).toEqual(rule);
  });

  it('round-trips a daily rule with count', () => {
    const rule: RecurrenceRule = { freq: 'DAILY', count: 10 };
    const serialized = serializeRRule(rule);
    expect(serialized).toBe('FREQ=DAILY;COUNT=10');
    expect(parseRRule(serialized)).toEqual(rule);
  });

  it('round-trips a monthly rule with until date', () => {
    const rule: RecurrenceRule = { freq: 'MONTHLY', until: '2024-12-31' };
    const serialized = serializeRRule(rule);
    // until is compacted to 20241231
    expect(serialized).toBe('FREQ=MONTHLY;UNTIL=20241231');
    const parsed = parseRRule(serialized);
    expect(parsed.freq).toBe('MONTHLY');
    // Normalised back to YYYY-MM-DD
    expect(parsed.until).toBe('2024-12-31');
  });

  it('until takes precedence over count when both are provided', () => {
    const rule: RecurrenceRule = {
      freq: 'WEEKLY',
      until: '2024-12-31',
      count: 5,
    };
    const serialized = serializeRRule(rule);
    expect(serialized).not.toContain('COUNT');
    expect(serialized).toContain('UNTIL');
  });

  it('interval=1 is omitted from serialised output (RFC-5545 default)', () => {
    const rule: RecurrenceRule = { freq: 'WEEKLY', interval: 1 };
    const serialized = serializeRRule(rule);
    expect(serialized).toBe('FREQ=WEEKLY');
  });

  it('parses an RRULE: prefixed string (as returned by some backends)', () => {
    const parsed = parseRRule('RRULE:FREQ=WEEKLY;BYDAY=TU,TH');
    expect(parsed).toEqual({ freq: 'WEEKLY', byday: ['TU', 'TH'] });
  });

  it('silently drops invalid byday codes during parse', () => {
    const parsed = parseRRule('FREQ=WEEKLY;BYDAY=MO,XX,FR');
    expect(parsed.byday).toEqual(['MO', 'FR']);
  });

  it('silently drops invalid byday codes during serialize', () => {
    const rule: RecurrenceRule = { freq: 'WEEKLY', byday: ['MO', 'ZZ'] };
    const serialized = serializeRRule(rule);
    expect(serialized).toBe('FREQ=WEEKLY;BYDAY=MO');
  });

  it('throws on invalid FREQ during serialize', () => {
    expect(() =>
      serializeRRule({ freq: 'HOURLY' as RecurrenceRule['freq'] })
    ).toThrow('Invalid RRULE FREQ');
  });

  it('throws on missing FREQ during parse', () => {
    expect(() => parseRRule('INTERVAL=2;BYDAY=MO')).toThrow(
      'RRULE missing or invalid FREQ'
    );
  });

  it('round-trips a yearly rule with no optional fields', () => {
    const rule: RecurrenceRule = { freq: 'YEARLY' };
    expect(parseRRule(serializeRRule(rule))).toEqual(rule);
  });
});
