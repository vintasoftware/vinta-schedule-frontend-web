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
// handleProviderLoginCallback — server-resolved `destination`
// ---------------------------------------------------------------------------

const AUTHENTICATED_200 = {
  status: 200,
  data: { user: { id: 42 } },
  meta: { access_token: 'acc-token', refresh_token: 'ref-token' },
};

describe('handleProviderLoginCallback — destination-based redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCookie.mockReturnValue({ value: 'incoming-session-token' });
  });

  it('redirects to the backend-resolved destination when present', async () => {
    mockCallbackJson({
      ...AUTHENTICATED_200,
      destination: 'https://app.reseller.com/dashboard',
    });

    const result = await handleProviderLoginCallback('google', {
      code: 'abc',
      tenant_id: 'tenant-99',
    });

    expect(result.url).toBe('https://app.reseller.com/dashboard');
  });

  it('falls back to the success interstitial when destination is absent', async () => {
    mockCallbackJson(AUTHENTICATED_200);

    const result = await handleProviderLoginCallback('google', {
      code: 'abc',
      tenant_id: 'tenant-99',
    });

    expect(result.url).toBe('/auth/social/google/success?tenant_id=tenant-99');
  });

  it('falls back to the success interstitial when destination is an empty string', async () => {
    mockCallbackJson({ ...AUTHENTICATED_200, destination: '' });

    const result = await handleProviderLoginCallback('google', {
      code: 'abc',
      tenant_id: 'tenant-99',
    });

    expect(result.url).toBe('/auth/social/google/success?tenant_id=tenant-99');
  });

  it('never imports or calls the removed fetchValidatedReturnUrl / client next-allowlist logic', async () => {
    mockCallbackJson({
      ...AUTHENTICATED_200,
      destination: 'https://app.reseller.com/dashboard',
    });

    await handleProviderLoginCallback('google', {
      code: 'abc',
      tenant_id: 'tenant-99',
      next: 'https://evil.com/phish',
    });

    // The function no longer exists on the module at all — it can't have
    // been called if it was never imported.
    const brandingServer = await import('@/lib/branding-server');
    expect(
      (brandingServer as Record<string, unknown>).fetchValidatedReturnUrl
    ).toBeUndefined();
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

describe('POST handler — absolute destination URL is not origin-prefixed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCookie.mockReturnValue({ value: 'incoming-session-token' });
    mockCallbackJson({
      ...AUTHENTICATED_200,
      destination: RESELLER_ABSOLUTE_URL,
    });
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
        }),
      }
    );

    await POST(request, { params: Promise.resolve({ provider: 'google' }) });

    const redirectUrl: string = mockRedirect.mock.calls[0][0];
    expect(redirectUrl).toBe(RESELLER_ABSOLUTE_URL);
    expect(redirectUrl).not.toContain('localhost');
    expect(redirectUrl).not.toMatch(/^https?:\/\/[^/]+https?:\/\//);
  });
});

describe('GET handler — absolute destination URL is not origin-prefixed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCookie.mockReturnValue({ value: 'incoming-session-token' });
    mockCallbackJson({
      ...AUTHENTICATED_200,
      destination: RESELLER_ABSOLUTE_URL,
    });
  });

  it('redirects to exactly the absolute URL — no localhost prefix', async () => {
    const request = new Request(
      `http://localhost:3000/auth/social/google/callback?code=abc&tenant_id=tenant-99`,
      {
        method: 'GET',
        headers: {
          host: 'localhost:3000',
          'x-forwarded-proto': 'https',
        },
      }
    );

    await GET(request, { params: Promise.resolve({ provider: 'google' }) });

    const redirectUrl: string = mockRedirect.mock.calls[0][0];
    expect(redirectUrl).toBe(RESELLER_ABSOLUTE_URL);
    expect(redirectUrl).not.toContain('localhost');
    expect(redirectUrl).not.toMatch(/^https?:\/\/[^/]+https?:\/\//);
  });
});
