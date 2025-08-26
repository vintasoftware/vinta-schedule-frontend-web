import { postAppV1AuthProviderRedirectJson } from '@/addicional-auth-client/provider-login-json';
import { useMutation } from '@tanstack/react-query';

interface ProviderLogin {
  provider: string;
  callbackUrl: string;
  process: 'login' | 'signup';
}

interface ProviderLoginResponse {
  redirect_url: string;
  session_token: string;
}

export function useProviderLogin() {
  const providerLoginMutation = useMutation({
    mutationFn: async ({
      provider,
      callbackUrl,
      process,
    }: ProviderLogin): Promise<ProviderLoginResponse> => {
      try {
        const response = await postAppV1AuthProviderRedirectJson({
          provider,
          callbackUrl,
          process,
        });
        const data = (await response.json()) as ProviderLoginResponse;
        localStorage.setItem('sessionToken', data.session_token);
        document.cookie = `sessionToken=${data.session_token}; path=/; Secure; SameSite=Lax`;
        return data;
      } catch (error) {
        throw error;
      }
    },
    retry: false,
  });

  const providerLogin = async (data: ProviderLogin) => {
    const result = await providerLoginMutation.mutateAsync(data);
    return result;
  };

  return { providerLogin, providerLoginMutation };
}
