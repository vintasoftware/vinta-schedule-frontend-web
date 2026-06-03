import { deleteAuthByClientV1AuthSessionMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

function clearLocalTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('sessionToken');
  localStorage.removeItem('uid');
  const expire = 'path=/; Secure; SameSite=Lax; Max-Age=0';
  document.cookie = `accessToken=; ${expire}`;
  document.cookie = `refreshToken=; ${expire}`;
  document.cookie = `sessionToken=; ${expire}`;
}

export function useLogout() {
  const logoutMutation = useMutation({
    ...deleteAuthByClientV1AuthSessionMutation(),
  });

  const logout = async () => {
    try {
      // DELETE /auth/app/v1/auth/session — ends the allauth session (needs X-Session-Token).
      await logoutMutation.mutateAsync({
        path: {
          client: 'app',
        },
        headers: {
          'X-Session-Token': localStorage.getItem('sessionToken') || '',
        },
      });
    } finally {
      // Always drop local tokens, even if the server call fails.
      clearLocalTokens();
    }
  };

  return {
    logout,
    logoutMutation,
  };
}
