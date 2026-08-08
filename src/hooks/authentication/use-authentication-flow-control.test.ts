/**
 * Landing behavior after a completed authentication.
 *
 * The backend resolves a post-auth `destination` from the acting org's
 * branding `redirect_url`. When it sends one, we must honor it instead of
 * dropping the user on the app root.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/auth-server-actions', () => ({
  storeAuthTokens: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/token-storage-strategy.client', () => ({
  setMemoryAccessToken: vi.fn(),
}));
vi.mock('@/lib/session-token', () => ({
  persistSessionToken: vi.fn(),
}));

import { useAuthenticationFlowControl } from './use-authentication-flow-control';

const push = vi.fn();
const assign = vi.fn();

function authenticatedResponse(extra: Record<string, unknown> = {}) {
  return {
    status: 200,
    data: { user: { id: 1 } },
    meta: { access_token: 'access', refresh_token: 'refresh' },
    ...extra,
  };
}

describe('useAuthenticationFlowControl — landing after authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      ...globalThis.window,
      location: { assign, origin: 'https://app.vinta.example.com' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lands on the dashboard when the response carries no destination', async () => {
    await useAuthenticationFlowControl({ push })(authenticatedResponse());

    // Never `/` — that is the public marketing page.
    expect(push).toHaveBeenCalledWith('/dashboard');
    expect(assign).not.toHaveBeenCalled();
  });

  it('navigates out for an absolute destination on a tenant host', async () => {
    await useAuthenticationFlowControl({ push })(
      authenticatedResponse({ destination: 'https://app.reseller.com/start' })
    );

    // Another origin genuinely needs a document navigation.
    expect(assign).toHaveBeenCalledWith('https://app.reseller.com/start');
    expect(push).not.toHaveBeenCalled();
  });

  it('routes in-app for the backend dashboard fallback on our own origin', async () => {
    // What an org with no configured redirect_url gets: an ABSOLUTE URL that
    // happens to be us (FRONTEND_BASE_URL + FRONTEND_DASHBOARD_PATH). Reloading
    // the document here would discard the in-memory access token just set.
    await useAuthenticationFlowControl({ push })(
      authenticatedResponse({
        destination: 'https://app.vinta.example.com/dashboard',
      })
    );

    expect(push).toHaveBeenCalledWith('/dashboard');
    expect(assign).not.toHaveBeenCalled();
  });

  it('keeps query and hash when routing a same-origin destination in-app', async () => {
    await useAuthenticationFlowControl({ push })(
      authenticatedResponse({
        destination: 'https://app.vinta.example.com/calendars?view=week#today',
      })
    );

    expect(push).toHaveBeenCalledWith('/calendars?view=week#today');
    expect(assign).not.toHaveBeenCalled();
  });

  it('routes in-app for a relative branding destination', async () => {
    await useAuthenticationFlowControl({ push })(
      authenticatedResponse({ destination: '/calendars' })
    );

    expect(push).toHaveBeenCalledWith('/calendars');
    expect(assign).not.toHaveBeenCalled();
  });

  it('falls back to the dashboard for an unsafe destination', async () => {
    await useAuthenticationFlowControl({ push })(
      authenticatedResponse({ destination: '//evil.com/steal' })
    );

    expect(push).toHaveBeenCalledWith('/dashboard');
    expect(assign).not.toHaveBeenCalled();
  });

  it('falls back to the dashboard for a whitespace-only destination', async () => {
    await useAuthenticationFlowControl({ push })(
      authenticatedResponse({ destination: '   ' })
    );

    expect(push).toHaveBeenCalledWith('/dashboard');
    expect(assign).not.toHaveBeenCalled();
  });

  it('does not mistake a lookalike host for our own origin', async () => {
    await useAuthenticationFlowControl({ push })(
      authenticatedResponse({
        destination: 'https://app.vinta.example.com.evil.test/dashboard',
      })
    );

    expect(assign).toHaveBeenCalledWith(
      'https://app.vinta.example.com.evil.test/dashboard'
    );
    expect(push).not.toHaveBeenCalled();
  });
});
