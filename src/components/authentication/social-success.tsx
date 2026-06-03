'use client';

import { useAuthenticationFlowControl } from '@/hooks/authentication/use-authentication-flow-control';
import { useCurrentAuthSession } from '@/hooks/authentication/use-current-auth-session';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export interface SocialSuccessProps {
  sessionToken?: string;
  accessToken?: string;
  refreshToken?: string;
}

export function SocialSuccess({
  sessionToken,
  accessToken,
  refreshToken,
}: SocialSuccessProps) {
  const router = useRouter();
  const isAuthenticated = Boolean(accessToken);

  const { session, error: sessionError } = useCurrentAuthSession({
    enabled: Boolean(sessionToken) && !isAuthenticated,
  });
  const authenticationFlowControl = useAuthenticationFlowControl(router);

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem('accessToken', accessToken || '');
      localStorage.setItem('refreshToken', refreshToken || '');
      localStorage.removeItem('sessionToken');

      router.push('/');
    }
    if (session && !isAuthenticated) {
      authenticationFlowControl(session);
    }
    if (sessionError) {
      authenticationFlowControl(sessionError);
    }
  }, [
    session,
    sessionError,
    isAuthenticated,
    accessToken,
    refreshToken,
    sessionToken,
    authenticationFlowControl,
    router,
  ]);

  return (
    <div className='flex min-h-screen flex-col items-center justify-center'>
      <div className='mb-2 text-lg font-semibold'>Connecting...</div>
      <div className='text-muted-foreground'>
        Please wait while we finish your social login.
      </div>
    </div>
  );
}
