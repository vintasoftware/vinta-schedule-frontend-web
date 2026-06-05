/**
 * usePublicApiTokens — list API token metadata.
 * useCreatePublicApiToken — create a token and return the one-time plaintext secret.
 *
 * SECURITY — no-persistence guarantee:
 *   - The list endpoint returns ONLY metadata (id, integration_name, is_active,
 *     available_resources). There is NO secret field in the list response.
 *   - The create response DOES include `token` (the plaintext secret) but we
 *     purposely do NOT cache it: we set `onSuccess: undefined` and rely on the
 *     caller capturing the return value of `createPublicApiToken(...)` in local
 *     component state only. When that local state is cleared on dialog close, the
 *     secret is gone from memory.
 *   - We never console.log the secret. We never persist it to localStorage,
 *     sessionStorage, or any global store.
 *
 * The list query key is exported as PUBLIC_API_TOKENS_QUERY_KEY so
 * `useCreatePublicApiToken` can invalidate it after a successful create.
 */

import {
  publicApiTokensListOptions,
  publicApiTokensListQueryKey,
  publicApiTokensCreateMutation,
} from '@/client/@tanstack/react-query.gen';
import type {
  SystemUserToken,
  SystemUserTokenCreate,
  SystemUserTokenResponse,
} from '@/client';
import type { DataTableQuery } from '@/components/data-table/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type { SystemUserToken, SystemUserTokenCreate, SystemUserTokenResponse };

export const PUBLIC_API_TOKENS_QUERY_KEY = publicApiTokensListQueryKey();

interface UsePublicApiTokensOptions {
  query?: DataTableQuery;
}

/**
 * usePublicApiTokens — fetch the list of API token metadata.
 *
 * The API returns PaginatedSystemUserTokenList; each item is SystemUserToken
 * (id, integration_name, is_active, available_resources). No secret is
 * present in the list response.
 */
export function usePublicApiTokens(options?: UsePublicApiTokensOptions) {
  const query = options?.query;

  const limit = query ? query.pageSize : undefined;
  const offset = query ? (query.page - 1) * query.pageSize : undefined;

  const tokensQuery = useQuery(
    publicApiTokensListOptions({ query: { limit, offset } })
  );

  const tokens: SystemUserToken[] = tokensQuery.data?.results ?? [];

  return {
    tokens,
    totalCount: tokensQuery.data?.count ?? 0,
    isLoading: tokensQuery.isLoading,
    isError: tokensQuery.isError,
    error: tokensQuery.error,
    tokensQuery,
  };
}

/**
 * useCreatePublicApiToken — create a new public-API token.
 *
 * SECURITY:
 *   The create response includes the plaintext `token` field ONCE.
 *   This hook returns it to the caller via the async fn return value.
 *   It is NOT stored in the query cache (no `onSuccess` cache set).
 *   The caller (new-token-dialog) holds it in LOCAL component state only,
 *   and MUST clear that state when the dialog closes.
 *
 *   After create succeeds, the token LIST is invalidated so metadata refreshes.
 */
export function useCreatePublicApiToken() {
  const queryClient = useQueryClient();

  const createPublicApiTokenMutation = useMutation({
    ...publicApiTokensCreateMutation(),
    onSuccess: () => {
      // Invalidate the list so metadata (name, scopes, active status) refreshes.
      // We do NOT cache or forward the secret here — it is only in the return
      // value of mutateAsync, which the dialog captures into local state.
      // Use the exported key for a prefix match so all paginated variants
      // (different limit/offset combos) are invalidated together.
      queryClient.invalidateQueries({
        queryKey: PUBLIC_API_TOKENS_QUERY_KEY,
      });
    },
  });

  /**
   * Create a new token. Returns the full SystemUserTokenResponse including the
   * one-time plaintext `token` field. Callers MUST capture this in local state
   * only and clear it on dialog close.
   */
  const createPublicApiToken = async (
    body: SystemUserTokenCreate
  ): Promise<SystemUserTokenResponse> =>
    createPublicApiTokenMutation.mutateAsync({ body });

  return { createPublicApiToken, createPublicApiTokenMutation };
}
