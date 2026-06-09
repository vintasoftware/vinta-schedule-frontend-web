'use server';

import { cookies } from 'next/headers';

const HTTPONLY_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

// Non-sensitive UI hint: tells client-side code a session exists without
// exposing any token value. JS-readable so components can check auth state
// without an extra network round-trip.
const SESSION_FLAG_OPTIONS = {
  httpOnly: false,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

export async function storeAuthTokens(accessToken: string, refreshToken: string) {
  const store = await cookies();
  store.set('accessToken', accessToken, HTTPONLY_COOKIE_OPTIONS);
  store.set('refreshToken', refreshToken, HTTPONLY_COOKIE_OPTIONS);
  store.set('sessionActive', '1', SESSION_FLAG_OPTIONS);
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.set('accessToken', '', { ...HTTPONLY_COOKIE_OPTIONS, maxAge: 0 });
  store.set('refreshToken', '', { ...HTTPONLY_COOKIE_OPTIONS, maxAge: 0 });
  store.set('sessionActive', '', { ...SESSION_FLAG_OPTIONS, maxAge: 0 });
}
