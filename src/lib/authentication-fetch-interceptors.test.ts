import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenStorageStrategy } from './base-token-storage-strategy';

/**
 * Mock TokenStorageStrategy for testing.
 * shouldIntercept() returns true so the interceptor block runs.
 * getAccessToken() returns null so only the org-header logic is exercised
 * (no Authorization header noise).
 */
class MockTokenStorage implements TokenStorageStrategy {
  shouldIntercept(): boolean {
    return true;
  }

  async getAccessToken(): Promise<string | null> {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async setAccessToken(_token: string): Promise<void> {
    // no-op for testing
  }

  async refreshTokens(): Promise<string | null> {
    return null;
  }

  async removeTokens(): Promise<void> {
    // no-op
  }
}

/**
 * Each test gets a freshly-imported module pair so the module-level
 * `configured` guard in authentication-fetch-interceptors.ts is reset to
 * false between tests (otherwise the second test's call to
 * configureClientAuthentication would be a no-op and the interceptor
 * block would never be registered again).
 *
 * The helper also wires a mockFetch into the client so we can inspect
 * the outgoing Request headers after interceptors have run.
 */
async function setupFreshModules() {
  vi.resetModules();

  // Import both modules fresh so module-level state is reset.
  const [interceptorsModule, clientModule, activeOrgModule] = await Promise.all(
    [
      import('./authentication-fetch-interceptors'),
      import('@/client/client.gen'),
      import('./active-organization'),
    ]
  );

  const { configureClientAuthentication } = interceptorsModule;
  const { client } = clientModule;
  const { setActiveOrganizationId, clearActiveOrganization } = activeOrgModule;

  // Wire a mock fetch so we can capture the outgoing Request.
  const mockFetch = vi.fn(async (_req: Request) => {
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  client.setConfig({
    fetch: mockFetch as typeof fetch,
    baseUrl: 'http://test.local',
  });

  // Register interceptors (this is the production code path being tested).
  const tokenStore = new MockTokenStorage();
  configureClientAuthentication(tokenStore);

  // Reset active org state for a clean slate.
  clearActiveOrganization();
  localStorage.clear();

  return {
    client,
    mockFetch,
    setActiveOrganizationId,
    clearActiveOrganization,
  };
}

describe('authentication-fetch-interceptors X-Organization-Id header injection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('injects X-Organization-Id header when an active organization is set', async () => {
    const { client, mockFetch, setActiveOrganizationId } =
      await setupFreshModules();

    // Set an active organization — the interceptor reads this via getActiveOrganizationId().
    setActiveOrganizationId('org-123');

    // Drive a real request through the client.
    await client.get({ url: '/test' });

    expect(mockFetch).toHaveBeenCalledOnce();
    const outgoingRequest: Request = mockFetch.mock.calls[0][0];
    expect(outgoingRequest.headers.get('X-Organization-Id')).toBe('org-123');
  });

  it('does not inject the header when no organization is set', async () => {
    const { client, mockFetch, clearActiveOrganization } =
      await setupFreshModules();

    // Ensure no active organization is selected.
    clearActiveOrganization();

    // Drive a real request through the client.
    await client.get({ url: '/test' });

    expect(mockFetch).toHaveBeenCalledOnce();
    const outgoingRequest: Request = mockFetch.mock.calls[0][0];
    expect(outgoingRequest.headers.get('X-Organization-Id')).toBeNull();
  });

  it('does not override an explicitly set X-Organization-Id header', async () => {
    const { client, mockFetch, setActiveOrganizationId } =
      await setupFreshModules();

    // Active org is set, but the caller also sets the header explicitly.
    setActiveOrganizationId('org-store');

    // Drive a request that already carries an explicit X-Organization-Id.
    await client.get({
      url: '/test',
      headers: { 'X-Organization-Id': 'org-explicit' },
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const outgoingRequest: Request = mockFetch.mock.calls[0][0];
    // The interceptor must NOT overwrite the caller-supplied value.
    expect(outgoingRequest.headers.get('X-Organization-Id')).toBe(
      'org-explicit'
    );
  });

  it('does not inject the header on the server side (SSR)', async () => {
    // Simulate SSR: hide the window global before the module is imported so
    // the interceptor sees `typeof window === 'undefined'` when it runs.
    vi.stubGlobal('window', undefined);

    try {
      const { client, mockFetch, setActiveOrganizationId } =
        await setupFreshModules();

      // Even though localStorage is not available (window is undefined in SSR),
      // we prime the in-memory store value directly via the fresh module's setter.
      // Under real SSR the store returns null (ensureInitialized short-circuits),
      // but here the interesting assertion is that the interceptor bails out of
      // header injection when `typeof window === 'undefined'`.
      // The production guard is: if (typeof window === 'undefined') return request;
      setActiveOrganizationId('org-789');

      // Drive a real request — the interceptor must not throw and must not inject
      // the header.
      await client.get({ url: '/test' });

      expect(mockFetch).toHaveBeenCalledOnce();
      const outgoingRequest: Request = mockFetch.mock.calls[0][0];
      expect(outgoingRequest.headers.get('X-Organization-Id')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
