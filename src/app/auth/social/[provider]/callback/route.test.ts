import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks -----------------------------------------------------------------

const getCookie = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: getCookie }),
}));

const postCallback = vi.fn();
vi.mock('@/addicional-auth-client/provider-login-callback-json', () => ({
  postAppV1AuthProviderCallbackJson: (...args: unknown[]) =>
    postCallback(...args),
}));

const mockFetchValidatedReturnUrl = vi.fn();
vi.mock('@/lib/branding-server', () => ({
  fetchValidatedReturnUrl: (...args: unknown[]) =>
    mockFetchValidatedReturnUrl(...args),
}));

import { handleProviderLoginCallback, GET, POST } from './route';

// The exact 401 body the headless callback returns for a brand-new Google user
// that still needs a phone number (intended allauth "pending signup" contract).
const PENDING_SIGNUP_401 = {
  status: 401,
  data: {
    flows: [
      { id: 'login' },
      { id: 'signup' },
      { id: 'provider_token', providers: ['google'] },
      {
        id: 'provider_signup',
        provider: {
          id: 'google',
          name: 'Google',
          flows: ['provider_redirect', 'provider_token'],
        },
        is_pending: true,
      },
    ],
  },
  meta: { is_authenticated: false, session_token: 'rotated-session-token' },
};

function mockCallbackJson(body: unknown) {
  postCallback.mockResolvedValue({ json: async () => body });
}

describe('handleProviderLoginCallback — pending social signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCookie.mockReturnValue({ value: 'incoming-session-token' });
  });

  it('does NOT throw on a 401 provider_signup pending response', async () => {
    mockCallbackJson(PENDING_SIGNUP_401);
    await expect(
      handleProviderLoginCallback('google', { code: 'abc' })
    ).resolves.toBeDefined();
  });

  it('routes the pending signup to the completion form, not the error page', async () => {
    mockCallbackJson(PENDING_SIGNUP_401);
    const result = await handleProviderLoginCallback('google', { code: 'abc' });
    expect(result.url).toBe('/auth/social/finish-signup');
    expect(result.url).not.toContain('error');
  });

  it('threads a rotated session_token forward as the sessionToken cookie', async () => {
    mockCallbackJson(PENDING_SIGNUP_401);
    const result = await handleProviderLoginCallback('google', { code: 'abc' });
    const sessionCookie = result.cookiesToSet?.find(
      (c) => c.name === 'sessionToken'
    );
    expect(sessionCookie?.value).toBe('rotated-session-token');
    // Stale auth tokens cleared while completing signup.
    expect(result.cookiesToUnset).toEqual(
      expect.arrayContaining(['accessToken', 'refreshToken'])
    );
  });

  it('keeps the redirect-json session token when the 401 does NOT rotate it', async () => {
    // allauth only emits meta.session_token on new/rotated tokens, so the
    // pending-signup 401 normally omits it. We must reuse the stored one.
    mockCallbackJson({
      ...PENDING_SIGNUP_401,
      meta: { is_authenticated: false },
    });
    const result = await handleProviderLoginCallback('google', { code: 'abc' });
    expect(result.url).toBe('/auth/social/finish-signup');
    const sessionCookie = result.cookiesToSet?.find(
      (c) => c.name === 'sessionToken'
    );
    expect(sessionCookie?.value).toBe('incoming-session-token');
  });

  it('routes a returning user with an unverified phone to phone verification', async () => {
    // callback-json 401 for a returning user whose login needs phone OTP.
    mockCallbackJson({
      status: 401,
      data: {
        flows: [{ id: 'login' }, { id: 'verify_phone', is_pending: true }],
      },
      meta: { is_authenticated: false, session_token: 'rotated-token' },
    });
    const result = await handleProviderLoginCallback('google', { code: 'abc' });
    expect(result.url).toBe('/auth/verify-phone');
    const sessionCookie = result.cookiesToSet?.find(
      (c) => c.name === 'sessionToken'
    );
    expect(sessionCookie?.value).toBe('rotated-token');
  });

  it('errors only when there is no stored token AND none was rotated', async () => {
    getCookie.mockReturnValue(undefined); // nothing persisted from redirect-json
    mockCallbackJson({
      ...PENDING_SIGNUP_401,
      meta: { is_authenticated: false },
    });
    const result = await handleProviderLoginCallback('google', { code: 'abc' });
    expect(result.url).toBe('/auth/social/error');
  });
});

describe('handleProviderLoginCallback — returning user (200)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCookie.mockReturnValue({ value: 'incoming-session-token' });
  });

  it('logs an existing Google user straight in', async () => {
    mockCallbackJson({
      status: 200,
      data: { user: { id: 1 } },
      meta: { access_token: 'acc', refresh_token: 'ref' },
    });
    const result = await handleProviderLoginCallback('google', { code: 'abc' });
    expect(result.url).toBe('/auth/social/google/success');
    const access = result.cookiesToSet?.find((c) => c.name === 'accessToken');
    expect(access?.value).toBe('acc');
  });
});

// ---------------------------------------------------------------------------
// handleProviderLoginCallback — `next` param + validateReturnUrl
// ---------------------------------------------------------------------------

const AUTHENTICATED_200 = {
  status: 200,
  data: { user: { id: 42 } },
  meta: { access_token: 'acc-token', refresh_token: 'ref-token' },
};

describe('handleProviderLoginCallback — next param redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCookie.mockReturnValue({ value: 'incoming-session-token' });
    mockFetchValidatedReturnUrl.mockResolvedValue(null);
  });

  it('redirects to the validated absolute URL when fetchValidatedReturnUrl resolves one', async () => {
    mockCallbackJson(AUTHENTICATED_200);
    mockFetchValidatedReturnUrl.mockResolvedValue(
      'https://app.reseller.com/dashboard'
    );

    const result = await handleProviderLoginCallback('google', {
      code: 'abc',
      tenant_id: 'tenant-99',
      next: 'https://app.reseller.com/dashboard',
    });

    expect(result.url).toBe('https://app.reseller.com/dashboard');
  });

  it('falls back to the success interstitial when fetchValidatedReturnUrl returns null', async () => {
    mockCallbackJson(AUTHENTICATED_200);
    mockFetchValidatedReturnUrl.mockResolvedValue(null);

    const result = await handleProviderLoginCallback('google', {
      code: 'abc',
      tenant_id: 'tenant-99',
      next: 'https://evil.com/phish',
    });

    expect(result.url).toBe('/auth/social/google/success?tenant_id=tenant-99');
  });

  it('threads tenant_id into the fallback success URL when next is off-allowlist', async () => {
    mockCallbackJson(AUTHENTICATED_200);
    mockFetchValidatedReturnUrl.mockResolvedValue(null);

    const result = await handleProviderLoginCallback('google', {
      code: 'abc',
      tenant_id: 'tenant-99',
      next: 'https://evil.com/phish',
    });

    expect(result.url).toContain('tenant_id=tenant-99');
  });

  it('falls back to success interstitial when no next param is present', async () => {
    mockCallbackJson(AUTHENTICATED_200);
    // fetchValidatedReturnUrl is not expected to be called (no next param)

    const result = await handleProviderLoginCallback('google', {
      code: 'abc',
      tenant_id: 'tenant-99',
    });

    expect(result.url).toBe('/auth/social/google/success?tenant_id=tenant-99');
  });
});

// ---------------------------------------------------------------------------
// POST / GET handlers — absolute URL must NOT be prefixed with request origin
// ---------------------------------------------------------------------------

// Guard against the open-redirect-concat bug class: an absolute sanitizedUrl
// returned by the backend (e.g. "https://app.reseller.com/dashboard") must be
// used as-is in the HTTP redirect — it must NOT be prepended with the request
// origin to produce garbage like "https://localhost...https://app.reseller.com".

const RESELLER_ABSOLUTE_URL = 'https://app.reseller.com/dashboard';

// Minimal NextResponse mock: capture the destination URL passed to redirect().
const mockRedirect = vi.fn((url: string) => ({
  url,
  cookies: { set: vi.fn(), delete: vi.fn() },
}));
vi.mock('next/server', () => ({
  NextResponse: { redirect: (url: string) => mockRedirect(url) },
}));

describe('POST handler — absolute validated next URL is not origin-prefixed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCookie.mockReturnValue({ value: 'incoming-session-token' });
    mockFetchValidatedReturnUrl.mockResolvedValue(RESELLER_ABSOLUTE_URL);
    mockCallbackJson(AUTHENTICATED_200);
  });

  it('redirects to exactly the absolute URL — no localhost prefix', async () => {
    const request = new Request(
      'http://localhost:3000/auth/social/google/callback',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: 'localhost:3000',
          'x-forwarded-proto': 'https',
        },
        body: JSON.stringify({
          code: 'abc',
          tenant_id: 'tenant-99',
          next: RESELLER_ABSOLUTE_URL,
        }),
      }
    );

    await POST(request, { params: Promise.resolve({ provider: 'google' }) });

    const destination: string = mockRedirect.mock.calls[0][0];
    expect(destination).toBe(RESELLER_ABSOLUTE_URL);
    expect(destination).not.toContain('localhost');
    expect(destination).not.toMatch(/^https?:\/\/[^/]+https?:\/\//);
  });
});

describe('GET handler — absolute validated next URL is not origin-prefixed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCookie.mockReturnValue({ value: 'incoming-session-token' });
    mockFetchValidatedReturnUrl.mockResolvedValue(RESELLER_ABSOLUTE_URL);
    mockCallbackJson(AUTHENTICATED_200);
  });

  it('redirects to exactly the absolute URL — no localhost prefix', async () => {
    const encodedNext = encodeURIComponent(RESELLER_ABSOLUTE_URL);
    const request = new Request(
      `http://localhost:3000/auth/social/google/callback?code=abc&tenant_id=tenant-99&next=${encodedNext}`,
      {
        method: 'GET',
        headers: {
          host: 'localhost:3000',
          'x-forwarded-proto': 'https',
        },
      }
    );

    await GET(request, { params: Promise.resolve({ provider: 'google' }) });

    const destination: string = mockRedirect.mock.calls[0][0];
    expect(destination).toBe(RESELLER_ABSOLUTE_URL);
    expect(destination).not.toContain('localhost');
    expect(destination).not.toMatch(/^https?:\/\/[^/]+https?:\/\//);
  });
});
