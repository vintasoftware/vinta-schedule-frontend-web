import { postAppV1AuthProviderRedirectJson } from '@/addicional-auth-client/provider-login-json';
import { formatProviderRedirectError } from '@/lib/provider-redirect-errors';
import { useMutation } from '@tanstack/react-query';

interface ProviderLogin {
  provider: string;
  callbackUrl: string;
  process: 'login' | 'signup';
}

interface ProviderLoginResponse {
  redirect_url: string;
  /** Stripped by the /api/allauth proxy (kept in the httpOnly cookie). */
  session_token?: string;
}

export function useProviderLogin() {
  const providerLoginMutation = useMutation({
    mutationFn: async ({
      provider,
      callbackUrl,
      process,
    }: ProviderLogin): Promise<ProviderLoginResponse> => {
      const response = await postAppV1AuthProviderRedirectJson({
        provider,
        callbackUrl,
        process,
      });
      const data = (await response.json()) as ProviderLoginResponse;
      if (!response.ok) {
        throw new Error(formatProviderRedirectError(data));
      }
      if (!data.redirect_url) {
        throw new Error(formatProviderRedirectError(data));
      }
      // The /api/allauth proxy strips the token (kept in the httpOnly
      // cookie); this only runs on legacy direct-to-backend responses.
      if (data.session_token) {
        localStorage.setItem('sessionToken', data.session_token);
        document.cookie = `sessionTokenPresent=1; path=/; Secure; SameSite=Lax`;
      }
      return data;
    },
    retry: false,
  });

  const providerLogin = async (data: ProviderLogin) => {
    const result = await providerLoginMutation.mutateAsync(data);
    return result;
  };

  return { providerLogin, providerLoginMutation };
}
