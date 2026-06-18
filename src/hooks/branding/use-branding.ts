import { brandingRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// BRANDING_QUERY_KEY — exported so mutations can invalidate this query.
// ---------------------------------------------------------------------------
export const BRANDING_QUERY_KEY = ['brandingRetrieve'] as const;

/**
 * Fetches the acting organization's branding configuration.
 *
 * Returns a 403 if the acting org is not a reseller — the hook passes the
 * raw status to callers so they can render a no-access state. A 404 means
 * "not yet configured" (no branding row) — callers should show an empty form.
 */
export function useBranding() {
  const brandingQuery = useQuery({
    ...brandingRetrieveOptions(),
    retry: false,
  });

  return { brandingQuery };
}
