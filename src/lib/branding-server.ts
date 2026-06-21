/**
 * Server-only branding fetch logic.
 *
 * This module is guarded by `import 'server-only'` — importing it from a
 * client component ('use client') will cause a build error, which is
 * intentional: server fetch logic (process.env reads, GraphQL calls) must
 * never run in the browser bundle.
 *
 * Client-safe exports (TenantBranding type, VINTA_DEFAULT_BRANDING) live in
 * `branding-shared.ts`.
 */
import 'server-only';

import {
  type TenantBranding,
  VINTA_DEFAULT_BRANDING,
} from '@/lib/branding-shared';

const VALIDATE_RETURN_URL_QUERY = `
  query ValidateReturnUrl($tenantId: ID!, $url: String!) {
    validateReturnUrl(tenantId: $tenantId, url: $url) {
      allowed
      sanitizedUrl
    }
  }
`;

const BRANDING_QUERY = `
  query BrandingForTenant($tenantId: ID!) {
    brandingForTenant(tenantId: $tenantId) {
      appName
      logoUrl
      primaryColor
      secondaryColor
    }
  }
`;

/**
 * Fetch branding for a tenant from the public (unauthenticated) GraphQL API.
 *
 * The endpoint is public and rate-limited by the backend; no auth token is
 * needed. On any failure (network, non-200, GraphQL error, null data) we
 * return VINTA_DEFAULT_BRANDING — the caller can always trust the return value.
 *
 * `tenantId` is the organization's ID from the OAuth state / query param.
 * If absent or empty, we skip the fetch and return the default immediately.
 */
export async function fetchBrandingForTenant(
  tenantId: string | null | undefined
): Promise<TenantBranding> {
  if (!tenantId) {
    return VINTA_DEFAULT_BRANDING;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

  const endpoint = `${baseUrl}/graphql/`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: BRANDING_QUERY,
        variables: { tenantId },
      }),
      // Don't block the page render for too long on a branding fetch.
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return VINTA_DEFAULT_BRANDING;
    }

    const json = (await response.json()) as {
      data?: { brandingForTenant?: TenantBranding | null };
      errors?: unknown[];
    };

    if (json.errors?.length) {
      return VINTA_DEFAULT_BRANDING;
    }

    const branding = json.data?.brandingForTenant;
    if (!branding) {
      return VINTA_DEFAULT_BRANDING;
    }

    // Merge with defaults so any missing field falls back gracefully.
    return {
      appName: branding.appName || VINTA_DEFAULT_BRANDING.appName,
      logoUrl: branding.logoUrl || VINTA_DEFAULT_BRANDING.logoUrl,
      primaryColor:
        branding.primaryColor || VINTA_DEFAULT_BRANDING.primaryColor,
      secondaryColor:
        branding.secondaryColor || VINTA_DEFAULT_BRANDING.secondaryColor,
    };
  } catch {
    // Network error, abort, parse failure — return the safe default.
    return VINTA_DEFAULT_BRANDING;
  }
}

/**
 * Ask the backend whether a given return URL is allowed for a tenant.
 *
 * The backend performs ALL matching and scheme-guard logic server-side —
 * the frontend just asks the yes/no question. The query is unauthenticated
 * and rate-limited on the backend side.
 *
 * FAIL CLOSED: any network error, non-200, GraphQL `errors`, null payload,
 * `allowed:false`, or thrown exception → null. Never throws.
 *
 * Returns the `sanitizedUrl` (an absolute URL) when the backend says allowed,
 * or null for every not-allowed case.
 */
export async function fetchValidatedReturnUrl(
  tenantId: string | null | undefined,
  url: string | null | undefined
): Promise<string | null> {
  if (!tenantId || !url) {
    return null;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

  const endpoint = `${baseUrl}/graphql/`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: VALIDATE_RETURN_URL_QUERY,
        variables: { tenantId, url },
      }),
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      data?: {
        validateReturnUrl?: {
          allowed: boolean;
          sanitizedUrl: string | null;
        } | null;
      };
      errors?: unknown[];
    };

    if (json.errors?.length) {
      return null;
    }

    const result = json.data?.validateReturnUrl;
    if (!result || !result.allowed || !result.sanitizedUrl) {
      return null;
    }

    return result.sanitizedUrl;
  } catch {
    // Network error, abort, parse failure — fail closed.
    return null;
  }
}
