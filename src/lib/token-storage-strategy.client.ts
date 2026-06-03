'use client';
import { TokenStorageStrategy } from './base-token-storage-strategy';

export class ClientTokenStorageStrategy implements TokenStorageStrategy {
  shouldIntercept() {
    return typeof window !== 'undefined'; // Always intercept on the client side
  }

  async getAccessToken() {
    const localToken = localStorage.getItem('accessToken');
    if (localToken !== null) return localToken;
    const cookieToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('accessToken='))
      ?.split('=')[1];
    return cookieToken ?? null;
  }

  async setAccessToken(token: string) {
    localStorage.setItem('accessToken', token);
    document.cookie = `accessToken=${token}; path=/; Secure; SameSite=Lax`;
  }

  async getRefreshToken() {
    const localToken = localStorage.getItem('refreshToken');
    if (localToken !== null) return localToken;
    const cookieToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('refreshToken='))
      ?.split('=')[1];
    return cookieToken ?? null;
  }

  async setRefreshToken(token: string) {
    localStorage.setItem('refreshToken', token);
    document.cookie = `refreshToken=${token}; path=/; Secure; SameSite=Lax`;
  }

  async removeTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    document.cookie = `accessToken=; path=/; Secure; SameSite=Lax; Max-Age=0`;
    document.cookie = `refreshToken=; path=/; Secure; SameSite=Lax; Max-Age=0`;
  }
}
