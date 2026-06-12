import { ChangePassword } from '@/auth-client';
import { postAuthByClientV1AccountPasswordChangeMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AUTH_SESSION_QUERY_KEY } from './use-auth-user';

/**
 * One endpoint covers both "set" (no current password yet) and "change".
 * Invalidates the session so `has_usable_password` flips after a first set.
 */
export function useChangePassword() {
  const queryClient = useQueryClient();
  const changePasswordMutation = useMutation({
    ...postAuthByClientV1AccountPasswordChangeMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
    },
  });

  const changePassword = async (body: ChangePassword) =>
    changePasswordMutation.mutateAsync({
      path: { client: 'app' },
      body,
    });

  return { changePassword, changePasswordMutation };
}
