/**
 * usePublicApiScopes — fetch the catalog of scopes a public-API token can hold.
 *
 * Wraps the generated TanStack Query operation for
 * `GET /public-api-docs/scopes/`, which returns one entry per member of the
 * backend's `PublicAPIResources` enum: the machine value, a human-readable
 * label, and whether the scope may be granted to a provider-scoped token.
 *
 * This replaces the hardcoded scope list the new-token dialog used to carry.
 * That copy had drifted badly — it listed 17 of the backend's 50+ resources,
 * so every scope added after it was written was simply un-grantable from the
 * UI. Reading the catalog from the API means a new backend resource shows up
 * in the picker with no frontend change at all.
 *
 * The catalog is static per deployment (it is the enum, not tenant data), and
 * the endpoint is unauthenticated, so the query is configured to be treated as
 * fresh for the lifetime of the page rather than refetched on every mount of
 * the dialog.
 */

import { publicApiDocsScopesListOptions } from '@/client/@tanstack/react-query.gen';
import type { SystemUserScope } from '@/client';
import { useQuery } from '@tanstack/react-query';

export type { SystemUserScope };

/**
 * usePublicApiScopes — fetch the scope catalog.
 *
 * Returns the entries in the backend's enum declaration order, which groups
 * related resources together (all the calendar ones, all the
 * availability-window ones, ...) the way alphabetical order would not. Callers
 * should render them in the order received.
 */
export function usePublicApiScopes() {
  const scopesQuery = useQuery({
    ...publicApiDocsScopesListOptions(),
    // The catalog only changes when the backend ships a new resource, so a
    // refetch per dialog open would be pure overhead.
    staleTime: Infinity,
  });

  const scopes: SystemUserScope[] = scopesQuery.data ?? [];

  return {
    scopes,
    isLoading: scopesQuery.isLoading,
    isError: scopesQuery.isError,
    error: scopesQuery.error,
    scopesQuery,
  };
}
