import { deleteAuthByClientV1AuthSessionMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';
import { clearAuthCookies } from '@/lib/auth-server-actions';
import { clearMemoryAccessToken } from '@/lib/token-storage-strategy.client';

async function clearLocalTokens() {
  clearMemoryAccessToken();
  localStorage.removeItem('sessionToken');
  localStorage.removeItem('uid');
  document.cookie = `sessionToken=; path=/; Secure; SameSite=Lax; Max-Age=0`;
  await clearAuthCookies();
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
      await clearLocalTokens();
    }
  };

  return {
    logout,
    logoutMutation,
  };
}
