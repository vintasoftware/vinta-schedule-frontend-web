import { brandingRetrieve } from '@/client/sdk.gen';
import type { OrganizationBranding } from '@/client';
import { brandingRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// BRANDING_QUERY_KEY — exported so mutations can invalidate this query.
// Uses the generated key so invalidation matches what useQuery registers.
// ---------------------------------------------------------------------------
export const BRANDING_QUERY_KEY = brandingRetrieveOptions().queryKey;

export type BrandingResult =
  | { status: 'ok'; branding: OrganizationBranding }
  | { status: 'not_configured'; branding: null }
  | { status: 'forbidden' };

/**
 * Fetches the acting organization's branding configuration.
 *
 * Uses a custom queryFn (with throwOnError:false) to inspect the HTTP status
 * directly, mirroring use-current-organization.ts. This is needed because the
 * generated brandingRetrieveOptions uses throwOnError:true and throws the parsed
 * JSON body — which has no .status — so we can't distinguish 403 from 404.
 *
 * - 200 → { status: 'ok', branding }
 * - 404 → { status: 'not_configured', branding: null }  (first-write — not an error)
 * - 403 → { status: 'forbidden' }  (org is not a reseller or user is not admin)
 * - else → throws so TanStack marks the query as isError
 */
export function useBranding() {
  const brandingQuery = useQuery<BrandingResult>({
    queryKey: BRANDING_QUERY_KEY,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, response } = await brandingRetrieve({
        signal,
        throwOnError: false,
      });
      if (!response) {
        throw new Error('Failed to load branding settings (no response)');
      }
      if (response.status === 404) {
        return { status: 'not_configured', branding: null };
      }
      if (response.status === 403) {
        return { status: 'forbidden' };
      }
      if (!response.ok || !data) {
        throw new Error(
          `Failed to load branding settings (${response.status})`
        );
      }
      return { status: 'ok', branding: data };
    },
  });

  return { brandingQuery };
}
