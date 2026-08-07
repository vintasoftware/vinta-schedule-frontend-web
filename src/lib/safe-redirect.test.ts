import { describe, it, expect } from 'vitest';
import { getSafeNextPath } from '@/lib/safe-redirect';

describe('getSafeNextPath', () => {
  it('accepts a plain relative path', () => {
    expect(getSafeNextPath('/o/acme/auth/accept-invite/')).toBe(
      '/o/acme/auth/accept-invite/'
    );
  });

  it('accepts a relative path with a query string', () => {
    expect(getSafeNextPath('/o/acme/auth/accept-invite/?token=abc')).toBe(
      '/o/acme/auth/accept-invite/?token=abc'
    );
  });

  it.each([null, undefined, ''])('rejects %p', (value) => {
    expect(getSafeNextPath(value)).toBeNull();
  });

  it('rejects a protocol-relative URL (//host/...)', () => {
    expect(getSafeNextPath('//evil.example.com/phish')).toBeNull();
  });

  it('rejects a backslash-prefixed URL (browsers treat it as //)', () => {
    expect(getSafeNextPath('/\\evil.example.com/phish')).toBeNull();
  });

  it('rejects an absolute URL with a scheme', () => {
    expect(getSafeNextPath('https://evil.example.com/phish')).toBeNull();
  });

  it('rejects a javascript: URL', () => {
    expect(getSafeNextPath('javascript:alert(1)')).toBeNull();
  });

  it('rejects a path with no leading slash', () => {
    expect(getSafeNextPath('dashboard')).toBeNull();
  });
});
