/**
 * `/auth/login/[slug]` is the legacy branded login URL. Branded auth now lives
 * under `/o/{slug}/`, so this page only redirects — previously-issued branded
 * login links (invitation emails, partner handoffs) must keep working.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const permanentRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  permanentRedirect: (...args: unknown[]) => permanentRedirect(...args),
}));

import LegacyBrandedLoginPage from './page';

describe('LegacyBrandedLoginPage (/auth/login/[slug])', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to the canonical branded login URL', async () => {
    await LegacyBrandedLoginPage({
      params: Promise.resolve({ slug: 'acme' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/o/acme/auth/login');
  });

  it('carries the query string over so `next` survives the hop', async () => {
    await LegacyBrandedLoginPage({
      params: Promise.resolve({ slug: 'acme' }),
      searchParams: Promise.resolve({ next: '/dashboard' }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith(
      '/o/acme/auth/login?next=%2Fdashboard'
    );
  });

  it('keeps every value of a repeated query param', async () => {
    await LegacyBrandedLoginPage({
      params: Promise.resolve({ slug: 'acme' }),
      searchParams: Promise.resolve({ tag: ['a', 'b'] }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith(
      '/o/acme/auth/login?tag=a&tag=b'
    );
  });

  it('encodes a slug that is not URL-safe', async () => {
    await LegacyBrandedLoginPage({
      params: Promise.resolve({ slug: 'a b/c' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/o/a%20b%2Fc/auth/login');
  });
});
