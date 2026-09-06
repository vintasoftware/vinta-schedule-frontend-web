/**
 * Shared timezone picker data + display helpers for the public booking
 * surface.
 *
 * Moved out of `attendee-form.tsx` (its original, and only, home) so
 * `slot-picker.tsx` can offer the SAME zone-change control at the point
 * where times are actually read — see that file's doc comment for why the
 * control lives there now instead of appearing only after a time has
 * already been picked.
 */

import { DateTime } from '@/lib/datetime/index';

// A reasonably complete fallback for environments where
// `Intl.supportedValuesOf` isn't available (older engines / some test
// runners) — see `timezoneOptions` below.
const FALLBACK_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

/**
 * Every IANA zone the runtime knows about, via `Intl.supportedValuesOf` when
 * present (Node 18+ / evergreen browsers). Falls back to a short curated
 * list rather than throwing — a smaller picker beats a broken form.
 */
export function timezoneOptions(): { value: string; label: string }[] {
  const supportedValuesOf = (
    Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }
  ).supportedValuesOf;
  const zones =
    typeof supportedValuesOf === 'function'
      ? supportedValuesOf('timeZone')
      : FALLBACK_TIMEZONES;
  return zones.map((zone) => ({ value: zone, label: zone }));
}

/**
 * A short, human-readable label for an IANA zone — the bare id plus its
 * current abbreviation, e.g. `"America/New_York (EST)"`. Falls back to the
 * bare zone string when the abbreviation can't be resolved (invalid zone),
 * so a caller can always render SOMETHING rather than a blank.
 */
export function timezoneDisplayLabel(zone: string): string {
  const dt = DateTime.now().setZone(zone);
  if (!dt.isValid) return zone;
  const abbreviation = dt.offsetNameShort;
  return abbreviation && abbreviation !== zone
    ? `${zone} (${abbreviation})`
    : zone;
}
