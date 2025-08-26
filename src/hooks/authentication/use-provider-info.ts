import { getAuthByClientV1AuthProviderSignupOptions } from '@/auth-client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function useProviderInfo() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const providerInfoQuery = useQuery({
    ...getAuthByClientV1AuthProviderSignupOptions({
      path: {
        client: 'app',
      },
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken,
      },
    }),
    retry: false,
  });

  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    if (token) {
      setSessionToken(token);
    }
  }, []);

  return {
    providerInfo: providerInfoQuery.data,
    isLoading: providerInfoQuery.isLoading,
    isError: providerInfoQuery.isError,
    error: providerInfoQuery.error,
  };
}
