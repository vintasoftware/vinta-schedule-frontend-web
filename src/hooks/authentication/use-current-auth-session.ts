import { getAuthByClientV1AuthSessionOptions } from '@/auth-client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function useCurrentAuthSession({ enabled }: { enabled: boolean }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const sessionQuery = useQuery({
    ...getAuthByClientV1AuthSessionOptions({
      path: {
        client: 'app',
      },
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
      },
    }),
    enabled: Boolean(sessionToken) && enabled,
  });

  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    if (token) {
      setSessionToken(token);
    }
  }, []);

  const { data: session, isLoading, isError, error } = sessionQuery;

  return {
    session,
    isLoading,
    isError,
    error,
    sessionQuery,
  };
}
