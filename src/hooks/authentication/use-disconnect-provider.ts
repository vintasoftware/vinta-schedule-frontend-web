import { ProviderAccount2 } from '@/auth-client';
import { deleteAuthByClientV1AccountProvidersMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ACCOUNT_PROVIDERS_QUERY_KEY } from './use-account-providers';

/**
 * Unlink a third-party account. The backend refuses to remove the last login
 * method when the user has no usable password — callers should surface that
 * 400 with a "set a password first" hint.
 */
export function useDisconnectProvider() {
  const queryClient = useQueryClient();
  const disconnectProviderMutation = useMutation({
    ...deleteAuthByClientV1AccountProvidersMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_PROVIDERS_QUERY_KEY });
    },
  });

  const disconnectProvider = async (body: ProviderAccount2) =>
    disconnectProviderMutation.mutateAsync({
      path: { client: 'app' },
      body,
    });

  return { disconnectProvider, disconnectProviderMutation };
}
