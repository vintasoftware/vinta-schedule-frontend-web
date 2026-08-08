import { describe, it, expect } from 'vitest';

import { isSafeDestination, getSafeDestination } from '@/lib/safe-destination';

describe('isSafeDestination', () => {
  it.each([
    'https://app.reseller.com/dashboard',
    'http://localhost:3000/dashboard',
    'HTTPS://APP.RESELLER.COM/',
    '/dashboard',
    '/',
  ])('accepts %s', (value) => {
    expect(isSafeDestination(value)).toBe(true);
  });

  it.each([
    ['a protocol-relative URL', '//evil.com/steal'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a data: URL', 'data:text/html,<script>'],
    ['a bare host', 'evil.com'],
    ['a relative path with no leading slash', 'dashboard'],
    ['an empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(isSafeDestination(value)).toBe(false);
  });
});

describe('getSafeDestination', () => {
  it('returns the trimmed destination when it is safe', () => {
    expect(getSafeDestination('  https://app.reseller.com/dashboard  ')).toBe(
      'https://app.reseller.com/dashboard'
    );
    expect(getSafeDestination('/dashboard')).toBe('/dashboard');
  });

  it('returns null for a whitespace-only value', () => {
    expect(getSafeDestination('   ')).toBeNull();
  });

  it('returns null when the field is absent or not a string', () => {
    expect(getSafeDestination(undefined)).toBeNull();
    expect(getSafeDestination(null)).toBeNull();
    expect(getSafeDestination(42)).toBeNull();
    expect(getSafeDestination({ url: '/dashboard' })).toBeNull();
  });

  it('returns null for an unsafe value rather than passing it through', () => {
    expect(getSafeDestination('//evil.com')).toBeNull();
    expect(getSafeDestination('javascript:alert(1)')).toBeNull();
  });
});
