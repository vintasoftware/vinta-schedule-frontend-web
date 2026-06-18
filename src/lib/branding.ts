/**
 * Tenant branding resolution for themed OAuth interstitials.
 *
 * The backend's public GraphQL `brandingForTenant` query walks the org parent
 * chain to the nearest reseller ancestor and returns its branding, or the
 * vinta-default sentinel when none exists. This module wraps that fetch with
 * a hard fallback guarantee: any network error, non-200, GraphQL error, null
 * payload, or missing tenantId MUST silently return VINTA_DEFAULT_BRANDING —
 * never throw, never block login.
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
    typeof window !== 'undefined'
      ? '' // relative on the browser — not expected to be called client-side
      : (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000');

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
