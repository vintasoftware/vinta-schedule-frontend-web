/**
 * Helpers around the rotating allauth `sessionToken`.
 *
 * The token is a full login credential (it authenticates every allauth
 * account-management endpoint), so the source of truth is an **httpOnly
 * `sessionToken` cookie** managed server-side (the `/api/allauth` BFF proxy
 * and the social-callback route handler). Browser JS cannot — and must not —
 * read it; client code only sees the JS-readable `sessionTokenPresent` flag,
 * used to gate "is a session in progress?" logic.
 *
 * The localStorage path below is a legacy/transition mechanism: older flow
 * hooks still read `localStorage.sessionToken` to set `X-Session-Token`
 * explicitly. In production that storage stays empty (the proxy strips tokens
 * from responses) and the proxy attaches the cookie value instead; tests
 * still seed it directly.
 */

/**
 * Persist a session token that reached client JS (legacy/transition paths
 * only — proxied responses never expose one). No-op outside the browser.
 */
export function persistSessionToken(token: string): void {
  if (typeof window === 'undefined' || !token) {
    return;
  }
  localStorage.setItem('sessionToken', token);
  document.cookie = `sessionTokenPresent=1; path=/; Secure; SameSite=Lax`;
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * Whether an allauth session is in progress / established, without exposing
 * the token itself: true when the server-set presence flag exists, with
 * legacy fallbacks for a token still held in JS-visible storage.
 */
export function hasSessionToken(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean(
    readCookie('sessionTokenPresent') ||
    localStorage.getItem('sessionToken') ||
    readCookie('sessionToken')
  );
}

/**
 * Legacy bridge: copy a JS-readable `sessionToken` cookie into localStorage
 * and return the effective token. With the httpOnly cookie model this finds
 * nothing (readCookie can't see httpOnly cookies) and returns whatever legacy
 * value localStorage holds — the BFF proxy supplies the real token instead.
 */
export function syncSessionTokenFromCookie(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const cookieToken = readCookie('sessionToken');
  if (cookieToken && cookieToken !== localStorage.getItem('sessionToken')) {
    localStorage.setItem('sessionToken', cookieToken);
  }
  return localStorage.getItem('sessionToken');
}
