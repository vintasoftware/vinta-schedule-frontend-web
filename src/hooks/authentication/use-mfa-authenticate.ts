import { MfaAuthenticate } from '@/auth-client';
import { postAuthByClientV1Auth2FaAuthenticateMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';
import { storeAuthTokens } from '@/lib/auth-server-actions';
import { setMemoryAccessToken } from '@/lib/token-storage-strategy.client';
import { persistSessionToken } from '@/lib/session-token';

/**
 * Submit the MFA login challenge (TOTP or recovery code). The pending-flow
 * session token is attached by the auth-client interceptor. On success the
 * response carries the final JWT/refresh pair — stored exactly like a
 * password login (memory + httpOnly cookies via server action).
 */
export function useMfaAuthenticate() {
  const mfaAuthenticateMutation = useMutation({
    ...postAuthByClientV1Auth2FaAuthenticateMutation(),
    retry: false,
  });

  const mfaAuthenticate = async (body: MfaAuthenticate) => {
    const result = await mfaAuthenticateMutation.mutateAsync({
      path: { client: 'app' },
      body,
    });

    const meta = result.meta as {
      access_token?: string;
      refresh_token?: string;
      session_token?: string;
    };
    if (result.data?.user?.id) {
      localStorage.setItem('uid', String(result.data.user.id));
    }
    if (meta?.access_token) {
      setMemoryAccessToken(meta.access_token);
      if (meta.refresh_token) {
        await storeAuthTokens(meta.access_token, meta.refresh_token);
      }
      // KEEP the (rotated) session token — account-management endpoints
      // authenticate via X-Session-Token even after full login.
      if (meta.session_token) {
        persistSessionToken(meta.session_token);
      }
    }

    return result;
  };

  return { mfaAuthenticate, mfaAuthenticateMutation };
}
