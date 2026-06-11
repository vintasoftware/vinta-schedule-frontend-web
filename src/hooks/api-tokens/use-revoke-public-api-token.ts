/**
 * useRevokePublicApiToken — revoke (invalidate) an API token.
 *
 * Calls POST /public-api-tokens/{id}/revoke/ to set the token's is_active to false.
 * The body is optional (per the API spec, body?: SystemUserToken);
 * since we're just triggering the revoke action, we send no body (undefined).
 *
 * On success, invalidates PUBLIC_API_TOKENS_QUERY_KEY so the list refetches
 * and shows the updated is_active status.
 */

import { publicApiTokensRevokeCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PUBLIC_API_TOKENS_QUERY_KEY } from './use-public-api-tokens';

export function useRevokePublicApiToken() {
  const queryClient = useQueryClient();

  const revokeMutation = useMutation({
    ...publicApiTokensRevokeCreateMutation(),
    onSuccess: () => {
      // Invalidate the list so it refetches and shows the updated is_active status.
      queryClient.invalidateQueries({
        queryKey: PUBLIC_API_TOKENS_QUERY_KEY,
      });
    },
  });

  /**
   * Revoke a token by its ID.
   * No body is sent; the API only needs the path parameter (id).
   */
  const revokeToken = async (id: string): Promise<void> => {
    await revokeMutation.mutateAsync({
      path: { id },
    });
  };

  return { revokeToken, revokeMutation };
}
