'use client';

import { useAuthenticationFlowControl } from '@/hooks/authentication/use-authentication-flow-control';
import { useCurrentAuthSession } from '@/hooks/authentication/use-current-auth-session';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Text } from '@/components/layout';
import { AuthNavbar } from '@/components/authentication/auth-navbar';

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
    <AuthLayout navbar={<AuthNavbar />} variant='single'>
      <Card className='flex flex-col items-center gap-2 p-8 text-center'>
        <Text as='div' size='lg' weight='semibold'>
          Connecting…
        </Text>
        <Text as='div' size='sm' color='muted-foreground'>
          Please wait while we finish your social login.
        </Text>
      </Card>
    </AuthLayout>
  );
}
