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

const BRANDING_BY_TENANT_ID_QUERY = `
  query BrandingForTenant($tenantId: ID!) {
    brandingForTenant(tenantId: $tenantId) {
      appName
      logoUrl
      primaryColor
      secondaryColor
    }
  }
`;

const BRANDING_BY_SLUG_QUERY = `
  query BrandingForTenantBySlug($slug: String!) {
    brandingForTenant(slug: $slug) {
      appName
      logoUrl
      primaryColor
      secondaryColor
    }
  }
`;

type BrandingGraphQLResponse = {
  data?: { brandingForTenant?: TenantBranding | null };
  errors?: unknown[];
};

function mergeWithDefaults(branding: TenantBranding): TenantBranding {
  // Merge with defaults so any missing field falls back gracefully.
  return {
    appName: branding.appName || VINTA_DEFAULT_BRANDING.appName,
    logoUrl: branding.logoUrl || VINTA_DEFAULT_BRANDING.logoUrl,
    primaryColor: branding.primaryColor || VINTA_DEFAULT_BRANDING.primaryColor,
    secondaryColor:
      branding.secondaryColor || VINTA_DEFAULT_BRANDING.secondaryColor,
  };
}

/**
 * POST the public GraphQL branding query and normalize the result.
 * On any failure (network, non-200, GraphQL error, null data) returns
 * VINTA_DEFAULT_BRANDING — callers can always trust the return value.
 */
async function fetchBrandingFromGraphQL(
  query: string,
  variables: Record<string, string>
): Promise<TenantBranding> {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

  const endpoint = `${baseUrl}/graphql/`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables,
      }),
      // Don't block the page render for too long on a branding fetch.
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return VINTA_DEFAULT_BRANDING;
    }

    const json = (await response.json()) as BrandingGraphQLResponse;

    if (json.errors?.length) {
      return VINTA_DEFAULT_BRANDING;
    }

    const branding = json.data?.brandingForTenant;
    if (!branding) {
      return VINTA_DEFAULT_BRANDING;
    }

    return mergeWithDefaults(branding);
  } catch {
    // Network error, abort, parse failure — return the safe default.
    return VINTA_DEFAULT_BRANDING;
  }
}

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

  return fetchBrandingFromGraphQL(BRANDING_BY_TENANT_ID_QUERY, { tenantId });
}

/**
 * Fetch branding by the organization's public slug (branded login route).
 *
 * Passes `slug` alone to `brandingForTenant` — do not combine with tenantId
 * (handoff: pass exactly one). Unknown/empty slug → VINTA_DEFAULT_BRANDING,
 * indistinguishable from an unbranded org (no error page).
 */
export async function fetchBrandingForSlug(
  slug: string | null | undefined
): Promise<TenantBranding> {
  const trimmed = slug?.trim();
  if (!trimmed) {
    return VINTA_DEFAULT_BRANDING;
  }

  return fetchBrandingFromGraphQL(BRANDING_BY_SLUG_QUERY, { slug: trimmed });
}
