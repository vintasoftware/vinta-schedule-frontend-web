import { getAuthByClientV1AccountAuthenticatorsOptions } from '@/auth-client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';

export const AUTHENTICATORS_QUERY_KEY =
  getAuthByClientV1AccountAuthenticatorsOptions({
    path: { client: 'app' },
  }).queryKey;

/** MFA authenticators (totp / recovery_codes) registered on the account. */
export function useAuthenticators() {
  const authenticatorsQuery = useQuery({
    ...getAuthByClientV1AccountAuthenticatorsOptions({
      path: { client: 'app' },
    }),
    retry: false,
  });

  return {
    authenticators: authenticatorsQuery.data?.data ?? [],
    isLoading: authenticatorsQuery.isLoading,
    isError: authenticatorsQuery.isError,
    error: authenticatorsQuery.error,
    authenticatorsQuery,
  };
}
