import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchBrandingForTenant } from './branding-server';
import { validateReturnUrl, VINTA_DEFAULT_BRANDING } from './branding-shared';

// ---------------------------------------------------------------------------
// fetchBrandingForTenant
// ---------------------------------------------------------------------------

describe('fetchBrandingForTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(response: Partial<Response & { ok: boolean }>) {
    global.fetch = vi.fn().mockResolvedValue(response);
  }

  function jsonFetch(status: number, body: unknown) {
    mockFetch({
      ok: status >= 200 && status < 300,
      json: async () => body,
    } as Response);
  }

  it('returns vinta default on null tenantId — never throws', async () => {
    const result = await fetchBrandingForTenant(null);
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });

  it('returns vinta default on undefined tenantId — never throws', async () => {
    const result = await fetchBrandingForTenant(undefined);
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });

  it('returns vinta default on empty string tenantId', async () => {
    const result = await fetchBrandingForTenant('');
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });

  it('returns resolved branding on a successful GraphQL response', async () => {
    jsonFetch(200, {
      data: {
        brandingForTenant: {
          appName: 'Acme Corp',
          logoUrl: 'https://acme.example.com/logo.svg',
          primaryColor: '#1a2b3c',
          secondaryColor: '#4d5e6f',
        },
      },
    });

    const result = await fetchBrandingForTenant('org-123');
    expect(result).toEqual({
      appName: 'Acme Corp',
      logoUrl: 'https://acme.example.com/logo.svg',
      primaryColor: '#1a2b3c',
      secondaryColor: '#4d5e6f',
    });
  });

  it('falls back to vinta default when response is non-200', async () => {
    mockFetch({ ok: false, json: async () => ({}) } as Response);

    const result = await fetchBrandingForTenant('org-123');
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });

  it('falls back to vinta default when response contains GraphQL errors', async () => {
    jsonFetch(200, {
      errors: [{ message: 'Org not found' }],
      data: null,
    });

    const result = await fetchBrandingForTenant('org-123');
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });

  it('falls back to vinta default when brandingForTenant is null (no reseller ancestor)', async () => {
    jsonFetch(200, {
      data: { brandingForTenant: null },
    });

    const result = await fetchBrandingForTenant('org-456');
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });

  it('falls back to vinta default on a network error — never throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchBrandingForTenant('org-123');
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });

  it('falls back to vinta default on a fetch timeout — never throws', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(
        new DOMException('The operation was aborted.', 'AbortError')
      );

    const result = await fetchBrandingForTenant('org-123');
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });

  it('uses vinta logo fallback when logoUrl is empty string in the response', async () => {
    jsonFetch(200, {
      data: {
        brandingForTenant: {
          appName: 'Acme Corp',
          logoUrl: '',
          primaryColor: '',
          secondaryColor: '',
        },
      },
    });

    const result = await fetchBrandingForTenant('org-123');
    expect(result.logoUrl).toBe(VINTA_DEFAULT_BRANDING.logoUrl);
    expect(result.appName).toBe('Acme Corp');
  });

  it('falls back to vinta default on a JSON parse failure — never throws', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    } as unknown as Response);

    const result = await fetchBrandingForTenant('org-123');
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });
});

// ---------------------------------------------------------------------------
// validateReturnUrl
// ---------------------------------------------------------------------------

describe('validateReturnUrl', () => {
  it('returns null when url is null', () => {
    expect(validateReturnUrl(null, ['https://app.example.com'])).toBeNull();
  });

  it('returns null when url is undefined', () => {
    expect(
      validateReturnUrl(undefined, ['https://app.example.com'])
    ).toBeNull();
  });

  it('returns null when url is empty string', () => {
    expect(validateReturnUrl('', ['https://app.example.com'])).toBeNull();
  });

  it('returns null when allowlist is empty', () => {
    expect(
      validateReturnUrl('https://app.example.com/dashboard', [])
    ).toBeNull();
  });

  it('returns the url when origin matches an allowlisted entry', () => {
    const url = 'https://app.example.com/dashboard?foo=bar';
    expect(validateReturnUrl(url, ['https://app.example.com'])).toBe(url);
  });

  it('returns null when origin does NOT match any allowlisted entry', () => {
    expect(
      validateReturnUrl('https://evil.com/phish', ['https://app.example.com'])
    ).toBeNull();
  });

  it('blocks open-redirect via subdomain confusion', () => {
    // "app.example.com.evil.com" must not match allowlist "app.example.com"
    expect(
      validateReturnUrl('https://app.example.com.evil.com/steal', [
        'https://app.example.com',
      ])
    ).toBeNull();
  });

  it('returns null for a relative URL (no origin)', () => {
    expect(
      validateReturnUrl('/relative/path', ['https://app.example.com'])
    ).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(
      validateReturnUrl('not-a-url', ['https://app.example.com'])
    ).toBeNull();
  });

  it('matches exact origin including port', () => {
    const url = 'http://localhost:3001/home';
    expect(validateReturnUrl(url, ['http://localhost:3001'])).toBe(url);
    expect(validateReturnUrl(url, ['http://localhost:3000'])).toBeNull();
  });

  it('accepts url matching any of multiple allowlisted origins', () => {
    const url = 'https://second.example.com/page';
    expect(
      validateReturnUrl(url, [
        'https://first.example.com',
        'https://second.example.com',
      ])
    ).toBe(url);
  });

  it('returns null for a javascript: URL — scheme guard', () => {
    // new URL('javascript:alert(1)') parses without throwing, so the scheme
    // guard must explicitly reject non-http(s) protocols before origin comparison.
    expect(
      validateReturnUrl('javascript:alert(1)', ['https://app.example.com'])
    ).toBeNull();
  });

  it('returns null for a data: URL — scheme guard', () => {
    expect(
      validateReturnUrl('data:text/html,<script>alert(1)</script>', [
        'https://app.example.com',
      ])
    ).toBeNull();
  });
});
