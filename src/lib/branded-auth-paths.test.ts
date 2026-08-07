import { describe, it, expect } from 'vitest';

import { brandedAuthPath } from '@/lib/branded-auth-paths';

describe('brandedAuthPath', () => {
  it('prefixes the tenant segment when a slug is given', () => {
    expect(brandedAuthPath('/auth/login', 'acme')).toBe('/o/acme/auth/login');
    expect(brandedAuthPath('/auth/signup', 'acme')).toBe('/o/acme/auth/signup');
    expect(brandedAuthPath('/auth/accept-invite', 'acme')).toBe(
      '/o/acme/auth/accept-invite'
    );
  });

  it('returns the generic path when there is no slug', () => {
    expect(brandedAuthPath('/auth/login', undefined)).toBe('/auth/login');
    expect(brandedAuthPath('/auth/signup', '')).toBe('/auth/signup');
    expect(brandedAuthPath('/auth/login', '   ')).toBe('/auth/login');
  });

  it('trims and encodes the slug', () => {
    expect(brandedAuthPath('/auth/login', '  acme  ')).toBe(
      '/o/acme/auth/login'
    );
    expect(brandedAuthPath('/auth/login', 'a b/c')).toBe(
      '/o/a%20b%2Fc/auth/login'
    );
  });
});
