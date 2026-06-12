import { getAuthByClientV1AuthSessionOptions } from '@/auth-client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';

export const AUTH_SESSION_QUERY_KEY = getAuthByClientV1AuthSessionOptions({
  path: { client: 'app' },
}).queryKey;

/**
 * The allauth view of the *logged-in* user (Bearer auth via interceptor) —
 * unlike `useCurrentAuthSession`, which tracks an in-progress login flow via
 * the session token. Source of `has_usable_password`, which decides whether
 * the password screen says "Set" or "Change".
 */
export function useAuthUser() {
  const sessionQuery = useQuery({
    ...getAuthByClientV1AuthSessionOptions({
      path: { client: 'app' },
    }),
    retry: false,
  });

  return {
    user: sessionQuery.data?.data?.user,
    isLoading: sessionQuery.isLoading,
    isError: sessionQuery.isError,
    error: sessionQuery.error,
    sessionQuery,
  };
}
