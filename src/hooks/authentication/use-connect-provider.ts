import { postAppV1AuthProviderRedirectJson } from '@/addicional-auth-client/provider-login-json';
import { persistSessionToken } from '@/lib/session-token';
import { useMutation } from '@tanstack/react-query';

interface ConnectProvider {
  provider: string;
  callbackUrl: string;
}

interface ConnectProviderResponse {
  redirect_url: string;
  /** Stripped by the /api/allauth proxy (kept in the httpOnly cookie). */
  session_token?: string;
}

/**
 * Start the OAuth dance that links a social account to the *current* user
 * (`process: "connect"`). The endpoint is an allauth headless view, so the
 * request authenticates via the stored `X-Session-Token` (the JWT is ignored
 * there); it must be the logged-in session or the backend treats the dance
 * as a login instead of a connect. The custom endpoint sits outside the
 * generated client, so the header is attached here explicitly.
 */
export function useConnectProvider() {
  const connectProviderMutation = useMutation({
    mutationFn: async ({
      provider,
      callbackUrl,
    }: ConnectProvider): Promise<ConnectProviderResponse> => {
      const sessionToken = localStorage.getItem('sessionToken');
      const response = await postAppV1AuthProviderRedirectJson({
        provider,
        callbackUrl,
        process: 'connect',
        headers: sessionToken ? { 'X-Session-Token': sessionToken } : undefined,
      });
      if (!response.ok) {
        throw await response.json();
      }
      const data = (await response.json()) as ConnectProviderResponse;
      // Normally the proxy keeps the token server-side; this only runs on
      // legacy direct-to-backend responses.
      if (data.session_token) persistSessionToken(data.session_token);
      // Lets the shared /account/provider/callback page know which provider
      // (and that a connect — not login — flow) is in progress.
      sessionStorage.setItem('connectProvider', provider);
      return data;
    },
    retry: false,
  });

  const connectProvider = async (data: ConnectProvider) =>
    connectProviderMutation.mutateAsync(data);

  return { connectProvider, connectProviderMutation };
}
