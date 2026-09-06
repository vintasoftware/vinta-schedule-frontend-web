import { describe, it, expect } from 'vitest';
import { timezoneOptions, timezoneDisplayLabel } from './timezone-options';

describe('timezoneOptions', () => {
  it('returns a non-empty list of IANA zone options with matching value/label', () => {
    const options = timezoneOptions();
    expect(options.length).toBeGreaterThan(0);
    expect(options.find((o) => o.value === 'America/New_York')).toBeTruthy();
    for (const option of options) {
      expect(option.value).toBe(option.label);
    }
  });
});

describe('timezoneDisplayLabel', () => {
  it('appends the zone abbreviation to a valid IANA zone', () => {
    expect(timezoneDisplayLabel('America/New_York')).toMatch(
      /^America\/New_York \([A-Z]{2,5}\)$/
    );
  });

  it('falls back to the bare zone string for an invalid zone', () => {
    expect(timezoneDisplayLabel('Not/AZone')).toBe('Not/AZone');
  });
});
