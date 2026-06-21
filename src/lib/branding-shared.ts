/**
 * Client-safe branding exports.
 *
 * This module contains ONLY pure types and constants that are safe to import
 * from client components ('use client'). The server-only fetch logic lives in
 * `branding-server.ts` (guarded by `import 'server-only'`).
 *
 * Return-URL validation is now performed server-side via the backend
 * `validateReturnUrl` GraphQL query (see `fetchValidatedReturnUrl` in
 * `branding-server.ts`).
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
