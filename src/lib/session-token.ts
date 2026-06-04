/**
 * Helpers for reading the rotating allauth `sessionToken`.
 *
 * The headless app client carries the in-progress login via the session token,
 * which rotates on every response (`meta.session_token`). Server route handlers
 * persist the latest value as the `sessionToken` cookie; the client-side auth
 * hooks read it from `localStorage`. `syncSessionTokenFromCookie` bridges the
 * two so a server redirect (e.g. callback 401 -> finish-signup) hands the
 * freshest token to the next client request via `X-Session-Token`.
 */

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
 * Copy the `sessionToken` cookie into `localStorage` when it is newer than the
 * stored value, returning the effective token. Safe to call during render
 * (idempotent, runs only in the browser).
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
