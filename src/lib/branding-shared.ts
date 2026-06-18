/**
 * Client-safe branding exports.
 *
 * This module contains ONLY pure types, constants, and helper functions that
 * are safe to import from client components ('use client'). The server-only
 * fetch logic lives in `branding-server.ts` (guarded by `import 'server-only'`).
 */

export interface TenantBranding {
  appName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
}

/**
 * Today's hardcoded vinta values. This is the authoritative fallback sentinel.
 * Any code path that fails to resolve a tenant must return exactly this object,
 * which ensures the pages render byte-for-byte as today's vinta pages.
 */
export const VINTA_DEFAULT_BRANDING: TenantBranding = {
  appName: 'Vinta Schedule',
  logoUrl: '/vinta-wordmark.svg',
  primaryColor: '',
  secondaryColor: '',
};

/**
 * Validate a return URL against a tenant's allowlist.
 *
 * Returns the URL if it starts with one of the allowlisted origins, or `null`
 * when it doesn't match (caller should fall back to the default dashboard).
 *
 * Rules:
 * - An empty or null `url` → null (use default).
 * - An empty `allowlist` → null (use default — no tenant URLs are approved).
 * - Only URLs whose origin matches an allowlisted origin are accepted.
 * - Open-redirect safety: we compare origins (scheme + host + port), not
 *   prefixes, so an allowlisted "https://app.example.com" does NOT allow
 *   "https://app.example.com.evil.com/".
 * - Scheme guard: only http: and https: are accepted — javascript: and data:
 *   URLs parse successfully but are rejected before the origin check.
 */
export function validateReturnUrl(
  url: string | null | undefined,
  allowlist: string[]
): string | null {
  if (!url || !allowlist.length) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  // Guard against dangerous schemes (javascript:, data:, etc.). new URL()
  // parses these successfully, so we must reject them explicitly before
  // comparing origins.
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return null;
  }

  const isAllowed = allowlist.some((allowed) => {
    try {
      const parsedAllowed = new URL(allowed);
      return parsedUrl.origin === parsedAllowed.origin;
    } catch {
      return false;
    }
  });

  return isAllowed ? url : null;
}
