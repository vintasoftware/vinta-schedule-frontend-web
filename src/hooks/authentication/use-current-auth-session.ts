import { getAuthByClientV1AuthSessionOptions } from '@/auth-client/@tanstack/react-query.gen';
import { hasSessionToken } from '@/lib/session-token';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function useCurrentAuthSession({ enabled }: { enabled: boolean }) {
  // Session presence + legacy token are browser-only state — read on mount.
  const [sessionState, setSessionState] = useState<{
    present: boolean;
    legacyToken: string | null;
  }>({ present: false, legacyToken: null });

  const sessionQuery = useQuery({
    ...getAuthByClientV1AuthSessionOptions({
      path: {
        client: 'app',
      },
      headers: {
        'Content-Type': 'application/json',
        // Legacy/transition: tests seed localStorage directly. In production
        // this is empty and the /api/allauth proxy attaches the httpOnly
        // cookie value instead.
        ...(sessionState.legacyToken
          ? { 'X-Session-Token': sessionState.legacyToken }
          : {}),
      },
    }),
    enabled: sessionState.present && enabled,
  });

  useEffect(() => {
    setSessionState({
      present: hasSessionToken(),
      legacyToken: localStorage.getItem('sessionToken'),
    });
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
