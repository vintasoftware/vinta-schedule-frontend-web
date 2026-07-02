/**
 * Duration helpers for booking-policy rule fields.
 *
 * BookingPolicy stores its four guardrails (lead_time, max_horizon,
 * buffer_before, buffer_after) as integer seconds. Humans think in minutes /
 * hours / days, so the form edits a {value, unit} pair and converts to/from
 * seconds at the API boundary.
 *
 * `0` means "no constraint for that field" and is always valid.
 */

export type DurationUnit = 'minutes' | 'hours' | 'days';

export const DURATION_UNIT_SECONDS: Record<DurationUnit, number> = {
  minutes: 60,
  hours: 3600,
  days: 86400,
};

export const DURATION_UNIT_OPTIONS: { value: DurationUnit; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
];

export interface DurationValue {
  value: number;
  unit: DurationUnit;
}

/** Convert a {value, unit} pair to whole seconds. */
export function durationToSeconds({ value, unit }: DurationValue): number {
  return Math.round(value * DURATION_UNIT_SECONDS[unit]);
}

/**
 * Convert seconds to the largest unit that divides evenly, so a round-trip of a
 * value entered as "2 hours" comes back as "2 hours" rather than "120 minutes".
 * `0` decomposes to `{ 0, minutes }` (the neutral default).
 */
export function secondsToDuration(seconds: number): DurationValue {
  if (!seconds || seconds <= 0) return { value: 0, unit: 'minutes' };

  if (seconds % DURATION_UNIT_SECONDS.days === 0) {
    return { value: seconds / DURATION_UNIT_SECONDS.days, unit: 'days' };
  }
  if (seconds % DURATION_UNIT_SECONDS.hours === 0) {
    return { value: seconds / DURATION_UNIT_SECONDS.hours, unit: 'hours' };
  }
  return {
    value: Math.round(seconds / DURATION_UNIT_SECONDS.minutes),
    unit: 'minutes',
  };
}

/**
 * Format seconds as a compact human string for table cells, e.g.
 * `0` → "None", 86400 → "1 day", 1800 → "30 min".
 */
export function formatDurationShort(seconds: number): string {
  if (!seconds || seconds <= 0) return 'None';

  const { value, unit } = secondsToDuration(seconds);
  const labels: Record<DurationUnit, [string, string]> = {
    minutes: ['min', 'min'],
    hours: ['hour', 'hours'],
    days: ['day', 'days'],
  };
  const [singular, plural] = labels[unit];
  return `${value} ${value === 1 ? singular : plural}`;
}
