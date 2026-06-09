'use server';

import { getCookieManager } from './authentication-cookie-manager.server';
import { TokenStorageStrategy } from './base-token-storage-strategy';

const HTTPONLY_COOKIE_OPTIONS = {
  httpOnly: true,
  path: '/',
  secure: true,
  sameSite: 'lax' as const,
};

class ServerTokenStorageStrategy implements TokenStorageStrategy {
  shouldIntercept() {
    return typeof window === 'undefined';
  }

  async getAccessToken() {
    const cookieManager = getCookieManager();
    const cookie = await cookieManager.get('accessToken');
    return cookie ? cookie : null;
  }

  async setAccessToken(token: string) {
    const cookieStorage = getCookieManager();
    cookieStorage.set('accessToken', token, HTTPONLY_COOKIE_OPTIONS);
    await cookieStorage.apply();
  }

  async refreshTokens() {
    const cookieManager = getCookieManager();
    const refreshToken = await cookieManager.get('refreshToken');
    if (!refreshToken) return null;

    // Server has direct backend access — no need to round-trip through the BFF.
    const { client: authClient } = await import('@/auth-client/client.gen');
    const response = await fetch(
      `${authClient.getConfig().baseUrl}/auth/app/v1/tokens/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }
    );

    if (response.status === 400) {
      await this.removeTokens();
      return null;
    }

    if (!response.ok) return null;

    const { data } = await response.json();
    const newAccessToken: string = data.access_token;
    const newRefreshToken: string | undefined = data.refresh_token;

    await this.setAccessToken(newAccessToken);
    if (newRefreshToken) {
      cookieManager.set('refreshToken', newRefreshToken, HTTPONLY_COOKIE_OPTIONS);
      await cookieManager.apply();
    }

    return newAccessToken;
  }

  async removeTokens() {
    const cookieStorage = getCookieManager();
    cookieStorage.set('accessToken', '', { ...HTTPONLY_COOKIE_OPTIONS, maxAge: 0 });
    cookieStorage.set('refreshToken', '', { ...HTTPONLY_COOKIE_OPTIONS, maxAge: 0 });
    await cookieStorage.apply();
  }
}

export { ServerTokenStorageStrategy };
