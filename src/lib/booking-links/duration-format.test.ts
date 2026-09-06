import { describe, it, expect } from 'vitest';
import {
  djangoDurationToMinutes,
  minutesToDjangoDuration,
  appointmentTypeDurationIsUnset,
} from './duration-format';

describe('minutesToDjangoDuration / djangoDurationToMinutes — round-trip', () => {
  it('round-trips a value with no hours component (guiding-decision example)', () => {
    expect(minutesToDjangoDuration(45)).toBe('00:45:00');
    expect(djangoDurationToMinutes('00:45:00')).toBe(45);
  });

  it('round-trips exactly on the hour boundary', () => {
    expect(minutesToDjangoDuration(60)).toBe('01:00:00');
    expect(djangoDurationToMinutes('01:00:00')).toBe(60);
  });

  it('round-trips a value spanning multiple hours and leftover minutes', () => {
    expect(minutesToDjangoDuration(90)).toBe('01:30:00');
    expect(djangoDurationToMinutes('01:30:00')).toBe(90);
  });

  it('round-trips zero', () => {
    expect(minutesToDjangoDuration(0)).toBe('00:00:00');
    expect(djangoDurationToMinutes('00:00:00')).toBe(0);
  });

  it('clamps a negative minute count to zero rather than emitting a negative string', () => {
    expect(minutesToDjangoDuration(-15)).toBe('00:00:00');
  });
});

describe('djangoDurationToMinutes — parsing beyond our own output', () => {
  it('treats absent, null, and empty as unset (0)', () => {
    expect(djangoDurationToMinutes(undefined)).toBe(0);
    expect(djangoDurationToMinutes(null)).toBe(0);
    expect(djangoDurationToMinutes('')).toBe(0);
  });

  it('tolerates an unpadded hour matching Django duration_string on the wire', () => {
    expect(djangoDurationToMinutes('1:00:00')).toBe(60);
  });

  it('rounds fractional seconds to the nearest minute', () => {
    expect(djangoDurationToMinutes('00:30:00.500000')).toBe(30);
  });

  it('accepts an explicit day-segment prefix (Django parse_duration input grammar)', () => {
    // 1 day + 1 hour = 25 hours = 1500 minutes.
    expect(djangoDurationToMinutes('1 01:00:00')).toBe(1500);
  });

  it('treats an unparsable string as unset (0) rather than throwing', () => {
    expect(djangoDurationToMinutes('not-a-duration')).toBe(0);
  });
});

describe('appointmentTypeDurationIsUnset', () => {
  it('is true for undefined, empty, and all-zero durations', () => {
    expect(appointmentTypeDurationIsUnset(undefined)).toBe(true);
    expect(appointmentTypeDurationIsUnset('')).toBe(true);
    expect(appointmentTypeDurationIsUnset('0:00:00')).toBe(true);
  });

  it('is false once any component is non-zero', () => {
    expect(appointmentTypeDurationIsUnset('00:30:00')).toBe(false);
    expect(appointmentTypeDurationIsUnset('01:00:00')).toBe(false);
  });
});
