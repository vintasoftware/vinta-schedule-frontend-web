import { postAppV1AuthProviderCallbackJson } from '@/addicional-auth-client/provider-login-callback-json';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ACCOUNT_PROVIDERS_QUERY_KEY } from './use-account-providers';

interface ConnectProviderCallback {
  provider: string;
  code: string;
  state: string;
}

export type ConnectProviderCallbackResult =
  | { outcome: 'connected' }
  | { outcome: 'cancelled' }
  | { outcome: 'error'; message?: string };

/**
 * Finish the social-connect OAuth dance: exchanges the provider's `code` +
 * `state` using the session token stored when the flow started. A 400 with
 * `error === "cancelled"` means the user aborted at the provider — a
 * dismissal, not a failure.
 */
export function useConnectProviderCallback() {
  const queryClient = useQueryClient();
  const connectProviderCallbackMutation = useMutation({
    mutationFn: async ({
      provider,
      code,
      state,
    }: ConnectProviderCallback): Promise<ConnectProviderCallbackResult> => {
      const response = await postAppV1AuthProviderCallbackJson({
        provider,
        queryParams: { code, state },
        sessionToken: localStorage.getItem('sessionToken') || undefined,
      });

      if (response.ok) {
        queryClient.invalidateQueries({
          queryKey: ACCOUNT_PROVIDERS_QUERY_KEY,
        });
        return { outcome: 'connected' };
      }

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (body.error === 'cancelled') {
        return { outcome: 'cancelled' };
      }
      return { outcome: 'error', message: body.message };
    },
    retry: false,
  });

  const connectProviderCallback = async (data: ConnectProviderCallback) =>
    connectProviderCallbackMutation.mutateAsync(data);

  return { connectProviderCallback, connectProviderCallbackMutation };
}
