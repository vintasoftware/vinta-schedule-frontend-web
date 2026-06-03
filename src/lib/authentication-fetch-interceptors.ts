import { client } from '@/client/client.gen';
import { client as authClient } from '@/auth-client/client.gen';
import { TokenStorageStrategy } from './base-token-storage-strategy';


function configureClientAuthentication(tokenStore: TokenStorageStrategy) {
  if (tokenStore.shouldIntercept()) {
    client.interceptors.request.use(includeTokenFromLocalStorageOrCookie(tokenStore));
    client.interceptors.response.use(refreshTokenAndRetryOnFailure(tokenStore));
  }
}

// Supports async functions
function includeTokenFromLocalStorageOrCookie(tokenStore: TokenStorageStrategy) {
  return async (request: Request) => {
    const token = await tokenStore.getAccessToken();

    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  };
}

function refreshTokenAndRetryOnFailure(tokenStore: TokenStorageStrategy) {
  return async (
    response: Response,
    request: Request
  ) => {
    if (
      !(
        response.status === 401 ||
        (response.status === 403 &&
          (await response.clone().json().catch(() => ({}))).detail ===
            'Authentication credentials were not provided.')
      )
    ) {
      return response; // Not an unauthorized error, return the response as is
    }

    const refreshToken = await tokenStore.getRefreshToken();

    if (!refreshToken) {
      return response; // No refresh token available, return the original response
    }

    // django-allauth native headless refresh (rotating, single-use tokens).
    const refreshTokenResponse = await fetch(
      `${authClient.getConfig().baseUrl}/auth/app/v1/tokens/refresh`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      }
    );

    if (refreshTokenResponse.status === 400) {
      // Refresh token is invalid/expired → force re-login.
      await tokenStore.removeTokens();
      return response;
    }

    if (!refreshTokenResponse.ok) {
      return response; // Transient failure, return the original response
    }

    // Shape: { status: 200, data: { access_token, refresh_token? } }
    const { data } = await refreshTokenResponse.json();
    const accessToken: string = data.access_token;
    const rotatedRefreshToken: string | undefined = data.refresh_token;

    await tokenStore.setAccessToken(accessToken);
    // Rotation: each refresh may return a NEW refresh token. Overwrite the
    // stored one; the old token is invalidated immediately. If absent, keep current.
    if (rotatedRefreshToken) {
      await tokenStore.setRefreshToken(rotatedRefreshToken);
    }

    const newHeaders = new Headers(request.headers);
    newHeaders.set('Authorization', `Bearer ${accessToken}`);

    const retryRequest = new Request(request, {
      headers: newHeaders,
    });

    return fetch(retryRequest);
  };
}

export { configureClientAuthentication };
