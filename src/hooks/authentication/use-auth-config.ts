import { getAuthByClientV1ConfigOptions } from '@/auth-client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';

export function useAuthConfig() {
  const authConfigQuery = useQuery({
    ...getAuthByClientV1ConfigOptions({
      path: {
        client: 'app',
      },
    }),
    retry: false,
  });

  return {
    authConfig: authConfigQuery.data,
    isLoading: authConfigQuery.isLoading,
    isError: authConfigQuery.isError,
    error: authConfigQuery.error,
  };
}
