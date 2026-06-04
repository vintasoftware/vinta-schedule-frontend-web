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

import { handleProviderLoginCallback } from './route';

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
