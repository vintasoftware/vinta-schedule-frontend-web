import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchBrandingForTenant,
  fetchBrandingForSlug,
} from './branding-server';
import { VINTA_DEFAULT_BRANDING } from './branding-shared';

// ---------------------------------------------------------------------------
// Shared fetch helpers
// ---------------------------------------------------------------------------

function mockFetch(response: Partial<Response & { ok: boolean }>) {
  global.fetch = vi.fn().mockResolvedValue(response);
}

function jsonFetch(status: number, body: unknown) {
  mockFetch({
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response);
}

function lastFetchBody(): { query: string; variables: Record<string, string> } {
  const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  return JSON.parse(call[1].body as string) as {
    query: string;
    variables: Record<string, string>;
  };
}

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

  it('sends the tenantId GraphQL variable (not slug)', async () => {
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

    await fetchBrandingForTenant('org-123');
    const body = lastFetchBody();
    expect(body.variables).toEqual({ tenantId: 'org-123' });
    expect(body.query).toContain('tenantId');
    expect(body.query).not.toContain('$slug');
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
// fetchBrandingForSlug
// ---------------------------------------------------------------------------

describe('fetchBrandingForSlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns vinta default on null slug — never throws', async () => {
    const result = await fetchBrandingForSlug(null);
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });

  it('returns vinta default on undefined slug — never throws', async () => {
    const result = await fetchBrandingForSlug(undefined);
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });

  it('returns vinta default on empty string slug', async () => {
    const result = await fetchBrandingForSlug('');
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });

  it('sends the slug GraphQL variable (not tenantId)', async () => {
    jsonFetch(200, {
      data: {
        brandingForTenant: {
          appName: 'Acme Scheduling',
          logoUrl: 'https://api.example.com/branding/logo/acme/',
          primaryColor: '#1A73E8',
          secondaryColor: '#FBBC04FF',
        },
      },
    });

    const result = await fetchBrandingForSlug('acme');
    expect(result).toEqual({
      appName: 'Acme Scheduling',
      logoUrl: 'https://api.example.com/branding/logo/acme/',
      primaryColor: '#1A73E8',
      secondaryColor: '#FBBC04FF',
    });

    const body = lastFetchBody();
    expect(body.variables).toEqual({ slug: 'acme' });
    expect(body.query).toContain('slug');
    expect(body.query).not.toContain('$tenantId');
  });

  it('falls back to vinta default when brandingForTenant is null (unknown slug)', async () => {
    jsonFetch(200, {
      data: { brandingForTenant: null },
    });

    const result = await fetchBrandingForSlug('no-such-org');
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });

  it('falls back to vinta default when response contains GraphQL errors', async () => {
    jsonFetch(200, {
      errors: [{ message: 'Invalid slug' }],
      data: null,
    });

    const result = await fetchBrandingForSlug('bad');
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });

  it('falls back to vinta default on a network error — never throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchBrandingForSlug('acme');
    expect(result).toEqual(VINTA_DEFAULT_BRANDING);
  });
});
