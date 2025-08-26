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
        (response.status === 403 && (await response.json()).detail === 'Authentication credentials were not provided.') ||
        request.url.includes('/auth/app/v1/refresh-token/')
      )
    ) {
      return response; // Not an unauthorized error, return the response as is
    }

    const refreshToken = await tokenStore.getRefreshToken();

    if (!refreshToken) {
      return response; // No refresh token available, return the original response
    }

    const refreshTokenResponse = await fetch(
      `${authClient.getConfig().baseUrl}/auth/app/v1/refresh-token/`,
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

    if (!refreshTokenResponse.ok) {
      return response; // Refresh token failed, return the original response
    }

    const { access_token: accessToken } = await refreshTokenResponse.json();

    await tokenStore.setAccessToken(accessToken);

    const newHeaders = new Headers(request.headers);
    newHeaders.set('Authorization', `Bearer ${accessToken}`);

    const retryRequest = new Request(request, {
      headers: newHeaders,
    });

    return fetch(retryRequest);
  };
}

export { configureClientAuthentication };
