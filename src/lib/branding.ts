/**
 * Tenant branding resolution for themed OAuth interstitials.
 *
 * This file re-exports from the split modules for backwards compatibility:
 * - Client-safe exports (type, constants, pure helpers) from `branding-shared`
 * - Server-only fetch from `branding-server` (guarded by `import 'server-only'`)
 *
 * New code should import directly from the specific module:
 *   - Client components → `@/lib/branding-shared`
 *   - Server components/route handlers → `@/lib/branding-server`
 *
 * This barrel re-export intentionally pulls in `branding-server` (server-only).
 * Do NOT import this file from client components — import `branding-shared` instead.
 */
export type { TenantBranding } from '@/lib/branding-shared';
export {
  VINTA_DEFAULT_BRANDING,
  validateReturnUrl,
} from '@/lib/branding-shared';
export { fetchBrandingForTenant } from '@/lib/branding-server';
