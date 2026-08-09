/**
 * format.ts tests.
 *
 * Covers:
 * - formatMoney formats a Decimal string in the API-provided currency, never a
 *   hard-coded symbol; different currencies render differently; a non-numeric
 *   amount falls back rather than "NaN".
 * - formatPeriod renders an ISO datetime; an unparseable input falls back.
 * - formatResourceTotal renders `null` as "Not recorded" and `0` as "0" — the
 *   two are visibly distinct.
 */

import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  formatPeriod,
  formatResourceTotal,
  NOT_RECORDED_LABEL,
} from './format';

describe('formatMoney', () => {
  it('formats a Decimal string in the given currency (no hard-coded symbol)', () => {
    // en-US pins the output so the assertion is stable across environments.
    expect(formatMoney('12.5000', 'USD', 'en-US')).toBe('$12.50');
  });

  it('uses the API-provided currency, not a fixed one', () => {
    const usd = formatMoney('12.5000', 'USD', 'en-US');
    const eur = formatMoney('12.5000', 'EUR', 'en-US');
    // Different currencies must produce different output — the symbol is never
    // hard-coded to `$`.
    expect(usd).not.toEqual(eur);
    expect(eur).toContain('12.50');
    expect(usd).not.toContain('€');
  });

  it('drops the Decimal storage-precision trailing zeros to the currency precision', () => {
    expect(formatMoney('100.0000', 'USD', 'en-US')).toBe('$100.00');
  });

  it('falls back to the raw amount + currency for a non-numeric amount', () => {
    expect(formatMoney('not-a-number', 'USD', 'en-US')).toBe(
      'not-a-number USD'
    );
  });
});

describe('formatPeriod', () => {
  it('formats an ISO datetime to a locale date-time string', () => {
    const out = formatPeriod('2026-08-09T14:30:00Z', 'en-US');
    // Not pinned to an exact string (timezone-dependent), but it must render a
    // real date, not the raw ISO input.
    expect(out).not.toBe('2026-08-09T14:30:00Z');
    expect(out).toMatch(/2026/);
  });

  it('falls back to the raw string for an unparseable input', () => {
    expect(formatPeriod('not-a-date')).toBe('not-a-date');
  });
});

describe('formatResourceTotal', () => {
  it('renders null as "Not recorded", never "0"', () => {
    expect(formatResourceTotal(null)).toBe(NOT_RECORDED_LABEL);
    expect(formatResourceTotal(null)).not.toBe('0');
  });

  it('renders 0 as "0"', () => {
    expect(formatResourceTotal(0)).toBe('0');
  });

  it('renders null and 0 as visibly distinct values', () => {
    expect(formatResourceTotal(null)).not.toEqual(formatResourceTotal(0));
  });

  it('renders a positive total as its string form', () => {
    expect(formatResourceTotal(42)).toBe('42');
  });
});
