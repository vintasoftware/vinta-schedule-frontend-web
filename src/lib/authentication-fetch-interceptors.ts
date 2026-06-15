import { client } from '@/client/client.gen';
import { client as authClient } from '@/auth-client/client.gen';
import { TokenStorageStrategy } from './base-token-storage-strategy';
import { persistSessionToken } from './session-token';
import { getActiveOrganizationId } from './active-organization';

async function readJsonBody(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    return null;
  }
  return response
    .clone()
    .json()
    .catch(() => null);
}

// Guard against double registration (the provider effect runs twice under
// React StrictMode in dev). Duplicate interceptors mean two independent
// single-flight refresh closures — racing refreshes burn the single-use
// rotating refresh token and log the user out.
let configured = false;

function configureClientAuthentication(tokenStore: TokenStorageStrategy) {
  if (!tokenStore.shouldIntercept() || configured) return;
  configured = true;

  // One in-flight refresh at a time. Concurrent 401s queue onto the same
  // promise so only one token rotation happens — preventing the race that
  // burns a single-use refresh token and forces re-login.
  let refreshPromise: Promise<string | null> | null = null;

  // Refresh failed (token invalid/expired or network error): clear the stale
  // tokens and bounce the user to the login page so they can re-authenticate.
  const logoutAndRedirect = async (): Promise<null> => {
    await tokenStore.removeTokens();
    if (typeof window !== 'undefined') {
      window.location.assign('/auth/login');
    }
    return null;
  };

  const refresh = async (): Promise<string | null> => {
    if (refreshPromise) return refreshPromise;
    refreshPromise = tokenStore
      .refreshTokens()
      .then((token) => token ?? logoutAndRedirect())
      .catch(() => logoutAndRedirect())
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  };

  const retryWithToken = (request: Request, token: string) => {
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(new Request(request, { headers }));
  };

  client.interceptors.request.use(async (request: Request) => {
    const token = await tokenStore.getAccessToken();
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  });

  // Inject X-Organization-Id header when an active organization is selected.
  // Browser-only guard: localStorage is unavailable on the server.
  // If a selection is set, include it on every tenant request (unless it's
  // already set, to allow explicit overrides in rare cases).
  client.interceptors.request.use(async (request: Request) => {
    if (typeof window === 'undefined') {
      // Server-side (SSR): never inject the header.
      return request;
    }

    const organizationId = getActiveOrganizationId();
    if (organizationId && !request.headers.has('X-Organization-Id')) {
      request.headers.set('X-Organization-Id', organizationId);
    }
    return request;
  });

  client.interceptors.response.use(
    async (response: Response, request: Request) => {
      const is401 = response.status === 401;
      const is403NoCreds =
        response.status === 403 &&
        (
          await response
            .clone()
            .json()
            .catch(() => ({}))
        ).detail === 'Authentication credentials were not provided.';

      if (!is401 && !is403NoCreds) return response;

      const newToken = await refresh();
      if (!newToken) return response;

      return retryWithToken(request, newToken);
    }
  );

  // The allauth headless endpoints authenticate exclusively via the rotating
  // `X-Session-Token` — the backend token strategy extends allauth's
  // SessionTokenStrategy and ignores the JWT there (verified against the live
  // API: Bearer-only → 401, session-token-only → 200). So: attach the stored
  // session token on the way out, persist each rotated `meta.session_token`
  // on the way back.
  //
  // Deliberately NO refresh-on-401 here: a 401 from allauth means a session
  // problem (or a pending flow), never an expired JWT. Refreshing on it burns
  // rotating refresh tokens for nothing and the race logs the user out.
  authClient.interceptors.request.use(async (request: Request) => {
    // `localStorage` only exists in the browser. The same interceptor is
    // registered server-side (SSR), where touching it throws and would fail
    // the request — e.g. the login page's config fetch losing its providers.
    const sessionToken =
      typeof window !== 'undefined'
        ? localStorage.getItem('sessionToken')
        : null;
    if (sessionToken && !request.headers.has('X-Session-Token')) {
      request.headers.set('X-Session-Token', sessionToken);
    }
    return request;
  });

  authClient.interceptors.response.use(async (response: Response) => {
    const body = await readJsonBody(response);
    const sessionToken = (body as { meta?: { session_token?: string } })?.meta
      ?.session_token;
    if (sessionToken) persistSessionToken(sessionToken);
    return response;
  });
}

export { configureClientAuthentication };
