'use server';

import { getCookieManager } from './authentication-cookie-manager.server';
import { TokenStorageStrategy } from './base-token-storage-strategy';

class ServerTokenStorageStrategy implements TokenStorageStrategy {
  shouldIntercept() {
    return typeof window === 'undefined'; // Always intercept on the server side
  }

  async getAccessToken() {
    const cookieManager = getCookieManager();
    const cookie = await cookieManager.get('accessToken');
    return cookie ? cookie : null;
  }

  async setAccessToken(token: string) {
    const cookieStorage = getCookieManager();
    cookieStorage.set('accessToken', token, {
      httpOnly: true,
      path: '/',
      secure: true,
      sameSite: 'lax',
    });

    await cookieStorage.apply();
  }
  async getRefreshToken() {
    const cookieManager = getCookieManager();
    const cookie = await cookieManager.get('refreshToken');
    return cookie ? cookie : null;
  }

  async setRefreshToken(token: string) {
    const cookieStorage = getCookieManager();
    cookieStorage.set('refreshToken', token, {
      httpOnly: true,
      path: '/',
      secure: true,
      sameSite: 'lax',
    });

    await cookieStorage.apply();
  }

  async removeTokens() {
    const cookieStorage = getCookieManager();
    cookieStorage.set('accessToken', '', {
      httpOnly: true,
      path: '/',
      secure: true,
      sameSite: 'lax',
      maxAge: 0,
    });
    cookieStorage.set('refreshToken', '', {
      httpOnly: true,
      path: '/',
      secure: true,
      sameSite: 'lax',
      maxAge: 0,
    });

    await cookieStorage.apply();
  }
}

export { ServerTokenStorageStrategy };
