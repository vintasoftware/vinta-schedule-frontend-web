import { describe, it, expect } from 'vitest';
import {
  durationToSeconds,
  secondsToDuration,
  formatDurationShort,
} from './duration';

describe('durationToSeconds', () => {
  it('converts each unit to seconds', () => {
    expect(durationToSeconds({ value: 30, unit: 'minutes' })).toBe(1800);
    expect(durationToSeconds({ value: 2, unit: 'hours' })).toBe(7200);
    expect(durationToSeconds({ value: 1, unit: 'days' })).toBe(86400);
  });

  it('rounds fractional inputs to whole seconds', () => {
    expect(durationToSeconds({ value: 1.5, unit: 'minutes' })).toBe(90);
  });
});

describe('secondsToDuration', () => {
  it('decomposes to the largest evenly-dividing unit', () => {
    expect(secondsToDuration(86400)).toEqual({ value: 1, unit: 'days' });
    expect(secondsToDuration(7200)).toEqual({ value: 2, unit: 'hours' });
    expect(secondsToDuration(1800)).toEqual({ value: 30, unit: 'minutes' });
  });

  it('maps zero / negative to the neutral minutes default', () => {
    expect(secondsToDuration(0)).toEqual({ value: 0, unit: 'minutes' });
    expect(secondsToDuration(-5)).toEqual({ value: 0, unit: 'minutes' });
  });

  it('round-trips a value entered in hours', () => {
    const seconds = durationToSeconds({ value: 24, unit: 'hours' });
    expect(secondsToDuration(seconds)).toEqual({ value: 1, unit: 'days' });
  });

  it('falls back to minutes for non-even values', () => {
    expect(secondsToDuration(90)).toEqual({ value: 2, unit: 'minutes' });
  });
});

describe('formatDurationShort', () => {
  it('renders None for zero', () => {
    expect(formatDurationShort(0)).toBe('None');
  });

  it('pluralizes correctly', () => {
    expect(formatDurationShort(86400)).toBe('1 day');
    expect(formatDurationShort(172800)).toBe('2 days');
    expect(formatDurationShort(3600)).toBe('1 hour');
    expect(formatDurationShort(1800)).toBe('30 min');
  });
});
