import {
  postAppV1AuthProviderCallbackJson,
  ProviderLoginCallbackParams,
} from '@/addicional-auth-client/provider-login-callback-json';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function useProviderLoginCallback() {
  const [sessionToken, setSessionToken] = useState<string | undefined>();
  const providerLoginCallbackMutation = useMutation({
    mutationFn: async ({
      provider,
      queryParams,
    }: ProviderLoginCallbackParams): Promise<undefined> => {
      try {
        await postAppV1AuthProviderCallbackJson({
          provider,
          queryParams,
          sessionToken,
        });
      } catch (error) {
        throw error;
      }
    },
    retry: false,
  });

  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    if (token) {
      setSessionToken(token);
    }
  }, []);

  const providerLoginCallback = async (data: ProviderLoginCallbackParams) => {
    const result = await providerLoginCallbackMutation.mutateAsync(data);
    return result;
  };

  return { providerLoginCallback, providerLoginCallbackMutation };
}
