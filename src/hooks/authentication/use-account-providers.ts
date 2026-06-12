import { getAuthByClientV1AccountProvidersOptions } from '@/auth-client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';

export const ACCOUNT_PROVIDERS_QUERY_KEY =
  getAuthByClientV1AccountProvidersOptions({
    path: { client: 'app' },
  }).queryKey;

/** Third-party accounts linked to the current user (Bearer auth via interceptor). */
export function useAccountProviders() {
  const providersQuery = useQuery({
    ...getAuthByClientV1AccountProvidersOptions({
      path: { client: 'app' },
    }),
    retry: false,
  });

  return {
    providerAccounts: providersQuery.data?.data ?? [],
    isLoading: providersQuery.isLoading,
    isError: providersQuery.isError,
    error: providersQuery.error,
    providersQuery,
  };
}
