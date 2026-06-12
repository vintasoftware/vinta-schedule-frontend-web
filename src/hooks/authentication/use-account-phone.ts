import { getAuthByClientV1AccountPhoneOptions } from '@/auth-client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';

export const ACCOUNT_PHONE_QUERY_KEY = getAuthByClientV1AccountPhoneOptions({
  path: { client: 'app' },
}).queryKey;

/** The phone number on the account (the backend supports a single one). */
export function useAccountPhone() {
  const phoneQuery = useQuery({
    ...getAuthByClientV1AccountPhoneOptions({
      path: { client: 'app' },
    }),
    retry: false,
  });

  return {
    phone: phoneQuery.data?.data?.[0],
    isLoading: phoneQuery.isLoading,
    isError: phoneQuery.isError,
    error: phoneQuery.error,
    phoneQuery,
  };
}
