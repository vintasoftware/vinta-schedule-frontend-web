/**
 * Client-safe branding exports.
 *
 * This module contains ONLY pure types and constants that are safe to import
 * from client components ('use client'). The server-only fetch logic lives in
 * `branding-server.ts` (guarded by `import 'server-only'`).
 *
 * Post-login navigation is resolved entirely server-side: the OAuth callback
 * response carries a `destination` field, and the SPA just navigates there
 * (see `src/app/auth/social/[provider]/callback/route.tsx`). There is no
 * client-side return-URL validation.
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
 * Whether the resolved branding is the vinta fallback rather than a tenant's
 * own identity.
 *
 * Both the logo AND the app name must match the sentinel. A tenant that set a
 * custom app name but kept the default logo (or vice-versa) counts as branded,
 * so neither value is silently dropped.
 *
 * Callers use this to decide whether to render tenant identity at all — the
 * navbar swaps the wordmark on it, and the branded signup route only locks the
 * organization field when it has a real tenant name to lock it to.
 */
export function isVintaDefaultBranding(branding: TenantBranding): boolean {
  return (
    branding.logoUrl === VINTA_DEFAULT_BRANDING.logoUrl &&
    branding.appName === VINTA_DEFAULT_BRANDING.appName
  );
}
