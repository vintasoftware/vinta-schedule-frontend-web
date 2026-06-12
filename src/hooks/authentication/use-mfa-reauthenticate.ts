import { MfaAuthenticate } from '@/auth-client';
import { postAuthByClientV1Auth2FaReauthenticateMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

/** TOTP/recovery-code reauthentication for sensitive operations (see `useReauthenticate`). */
export function useMfaReauthenticate() {
  const mfaReauthenticateMutation = useMutation({
    ...postAuthByClientV1Auth2FaReauthenticateMutation(),
    retry: false,
  });

  const mfaReauthenticate = async (body: MfaAuthenticate) =>
    mfaReauthenticateMutation.mutateAsync({
      path: { client: 'app' },
      body,
    });

  return { mfaReauthenticate, mfaReauthenticateMutation };
}
