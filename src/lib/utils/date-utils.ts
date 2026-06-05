/**
 * Legacy date formatting helpers — now backed by Luxon for consistency with
 * the rest of the datetime layer.  All function signatures are unchanged so
 * existing callers compile without modification.
 */

import { DateTime } from 'luxon';

type WeekdayEnum = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Format an ISO datetime string to a human-readable date + time.
 * Renders in the browser's local timezone (preserved from the original
 * behaviour using toLocaleDateString).
 *
 * Returns null when the input is falsy or not a valid datetime.
 */
export function formatDateTime(dateTime: string | null): string | null {
  if (!dateTime) return null;

  const dt = DateTime.fromISO(dateTime);
  if (!dt.isValid) return null;

  // Match the original: "June 5, 2026 at 02:30 PM"
  return dt.toLocaleString(DateTime.DATETIME_FULL);
}

/**
 * Format a duration string (HH:MM) to a human-readable label.
 * Returns "No duration" for empty or zero-duration values.
 */
export function formatDuration(duration: string | null): string {
  if (!duration || duration === '00:00') return 'No duration';

  const [hours, minutes] = duration.split(':').map(Number);
  return `${hours}h ${minutes}m`;
}

/**
 * Format a time string (HH:MM) to a 24-hour display string.
 * Returns "No time" for empty or midnight-zero values.
 */
export function formatTime(time: string | null): string {
  if (!time || time === '00:00') return 'No time';

  const [hours, minutes] = time.split(':').map(Number);
  // Build a fixed-date DateTime in local zone just to format the time portion
  const dt = DateTime.local().set({
    hour: hours,
    minute: minutes,
    second: 0,
    millisecond: 0,
  });
  // Match original: zero-padded 24-hour "HH:mm"
  return dt.toFormat('HH:mm');
}

/**
 * Convert a numeric weekday index to its full English name.
 * Index 0 = Sunday … 6 = Saturday (matches the original JS Date convention).
 */
export function formatWeekday(weekday: WeekdayEnum): string {
  const weekdays: Record<WeekdayEnum, string> = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  };
  return weekdays[weekday] ?? 'Unknown';
}
