/**
 * Pinned output tests for src/lib/utils/date-utils.ts.
 *
 * Each formatter is called with a fixed input and its output is pinned to the
 * exact string that the original toLocaleDateString / manual implementations
 * produced.  Any future drift (e.g. switching Luxon preset constants) will
 * fail these tests before reaching production.
 *
 * Tests run in the default system locale (en-US in CI) — the formatters do
 * not accept an explicit locale argument so the output is locale-dependent
 * by design (matching the original toLocaleDateString behaviour).
 */

import { describe, it, expect } from 'vitest';
import {
  formatDateTime,
  formatDuration,
  formatTime,
  formatWeekday,
} from './date-utils';

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------

describe('formatDateTime', () => {
  // Fixed input: 2026-06-05 at 14:30 local time.
  // Original Intl bag: { month:'long', day:'numeric', year:'numeric',
  //                      hour:'2-digit', minute:'2-digit' }
  // Expected: "June 5, 2026 at 02:30 PM"
  const ISO = '2026-06-05T14:30:00';

  it('produces the same output as the original toLocaleDateString bag', () => {
    const result = formatDateTime(ISO);
    // 2-digit hour with AM/PM, long month, no timeZoneName
    expect(result).toBe('June 5, 2026 at 02:30 PM');
  });

  it('returns null for null input', () => {
    expect(formatDateTime(null)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(formatDateTime('')).toBeNull();
  });

  it('returns null for a non-ISO garbage string', () => {
    expect(formatDateTime('not-a-date')).toBeNull();
  });

  it('does NOT include a timezone label (no timeZoneName in the Intl bag)', () => {
    const result = formatDateTime(ISO);
    // If DATETIME_FULL were used instead, the result would contain "GMT" or similar
    expect(result).not.toContain('GMT');
    expect(result).not.toContain('UTC');
  });

  it('uses 2-digit hour (leading zero for single-digit hours)', () => {
    // 09:05 local — original had hour:'2-digit', so "09:05 AM" not "9:05 AM"
    const result = formatDateTime('2026-06-05T09:05:00');
    expect(result).toContain('09:05 AM');
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe('formatDuration', () => {
  it('formats "01:30" as "1h 30m"', () => {
    expect(formatDuration('01:30')).toBe('1h 30m');
  });

  it('formats "02:00" as "2h 0m"', () => {
    expect(formatDuration('02:00')).toBe('2h 0m');
  });

  it('formats "00:45" as "0h 45m"', () => {
    expect(formatDuration('00:45')).toBe('0h 45m');
  });

  it('returns "No duration" for null', () => {
    expect(formatDuration(null)).toBe('No duration');
  });

  it('returns "No duration" for "00:00"', () => {
    expect(formatDuration('00:00')).toBe('No duration');
  });
});

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------

describe('formatTime', () => {
  it('formats "14:30" as "14:30"', () => {
    expect(formatTime('14:30')).toBe('14:30');
  });

  it('formats "09:05" as "09:05" (zero-padded 24-hour)', () => {
    expect(formatTime('09:05')).toBe('09:05');
  });

  it('formats "00:01" as "00:01"', () => {
    expect(formatTime('00:01')).toBe('00:01');
  });

  it('returns "No time" for null', () => {
    expect(formatTime(null)).toBe('No time');
  });

  it('returns "No time" for "00:00"', () => {
    expect(formatTime('00:00')).toBe('No time');
  });
});

// ---------------------------------------------------------------------------
// formatWeekday
// ---------------------------------------------------------------------------

describe('formatWeekday', () => {
  it('maps 0 → Sunday', () => {
    expect(formatWeekday(0)).toBe('Sunday');
  });

  it('maps 1 → Monday', () => {
    expect(formatWeekday(1)).toBe('Monday');
  });

  it('maps 2 → Tuesday', () => {
    expect(formatWeekday(2)).toBe('Tuesday');
  });

  it('maps 3 → Wednesday', () => {
    expect(formatWeekday(3)).toBe('Wednesday');
  });

  it('maps 4 → Thursday', () => {
    expect(formatWeekday(4)).toBe('Thursday');
  });

  it('maps 5 → Friday', () => {
    expect(formatWeekday(5)).toBe('Friday');
  });

  it('maps 6 → Saturday', () => {
    expect(formatWeekday(6)).toBe('Saturday');
  });
});
