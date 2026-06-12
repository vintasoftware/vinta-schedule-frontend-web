import { Reauthenticate } from '@/auth-client';
import { postAuthByClientV1AuthReauthenticateMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

/**
 * Password reauthentication for sensitive operations. The 401 that demanded
 * it carried a session token (persisted by the interceptor); the rotated
 * token from this response is persisted the same way, so the caller can
 * simply retry the original mutation afterwards.
 */
export function useReauthenticate() {
  const reauthenticateMutation = useMutation({
    ...postAuthByClientV1AuthReauthenticateMutation(),
    retry: false,
  });

  const reauthenticate = async (body: Reauthenticate) =>
    reauthenticateMutation.mutateAsync({
      path: { client: 'app' },
      body,
    });

  return { reauthenticate, reauthenticateMutation };
}
