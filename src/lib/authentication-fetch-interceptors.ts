import { client } from '@/client/client.gen';
import { TokenStorageStrategy } from './base-token-storage-strategy';

function configureClientAuthentication(tokenStore: TokenStorageStrategy) {
  if (!tokenStore.shouldIntercept()) return;

  // One in-flight refresh at a time. Concurrent 401s queue onto the same
  // promise so only one token rotation happens — preventing the race that
  // burns a single-use refresh token and forces re-login.
  let refreshPromise: Promise<string | null> | null = null;

  const refresh = async (): Promise<string | null> => {
    if (refreshPromise) return refreshPromise;
    refreshPromise = tokenStore
      .refreshTokens()
      .catch(async () => {
        await tokenStore.removeTokens();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  };

  client.interceptors.request.use(async (request: Request) => {
    const token = await tokenStore.getAccessToken();
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  });

  client.interceptors.response.use(async (response: Response, request: Request) => {
    const is401 = response.status === 401;
    const is403NoCreds =
      response.status === 403 &&
      (await response.clone().json().catch(() => ({}))).detail ===
        'Authentication credentials were not provided.';

    if (!is401 && !is403NoCreds) return response;

    const newToken = await refresh();
    if (!newToken) return response;

    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${newToken}`);
    return fetch(new Request(request, { headers }));
  });
}

export { configureClientAuthentication };
