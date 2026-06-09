'use client';
import { TokenStorageStrategy } from './base-token-storage-strategy';
import { clearAuthCookies } from './auth-server-actions';

let memoryAccessToken: string | null = null;

/** Set the in-memory access token directly (e.g. immediately after login). */
export function setMemoryAccessToken(token: string) {
  memoryAccessToken = token;
}

export function clearMemoryAccessToken() {
  memoryAccessToken = null;
}

export class ClientTokenStorageStrategy implements TokenStorageStrategy {
  shouldIntercept() {
    return typeof window !== 'undefined';
  }

  async getAccessToken() {
    return memoryAccessToken;
  }

  async setAccessToken(token: string) {
    memoryAccessToken = token;
  }

  async refreshTokens() {
    const response = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!response.ok) return null;
    const { access_token } = await response.json();
    memoryAccessToken = access_token as string;
    return access_token as string;
  }

  async removeTokens() {
    memoryAccessToken = null;
    await clearAuthCookies();
  }
}
