/**
 * A backend-resolved post-authentication `destination`.
 *
 * Unlike a client-supplied `?next=` (see `safe-redirect.ts`, which only allows
 * same-origin paths), this value is resolved server-side from the acting
 * organization's stored branding `redirect_url` — a white-label tenant is
 * expected to send its users to its own host, so absolute http(s) URLs are
 * legitimate here.
 *
 * Accepted:
 *   - an absolute `http(s)://…` URL
 *   - a same-origin path: a single leading `/`, not `//…` (which browsers
 *     treat as protocol-relative to an arbitrary host)
 *
 * Everything else — `javascript:`, `data:`, a bare host, `//evil.com` — is
 * rejected, and the caller falls back to its default landing page.
 */
export function isSafeDestination(destination: string): boolean {
  return /^https?:\/\//i.test(destination) || /^\/(?!\/)/.test(destination);
}

/**
 * Normalize an untrusted `destination` field off a response body into a value
 * that is safe to navigate to, or `null` when there isn't one.
 *
 * Trims first so a whitespace-only value falls back rather than being treated
 * as a real destination.
 */
export function getSafeDestination(destination: unknown): string | null {
  if (typeof destination !== 'string') return null;
  const trimmed = destination.trim();
  if (!trimmed || !isSafeDestination(trimmed)) return null;
  return trimmed;
}
