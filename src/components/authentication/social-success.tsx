'use client';

import { useAuthenticationFlowControl } from '@/hooks/authentication/use-authentication-flow-control';
import { useCurrentAuthSession } from '@/hooks/authentication/use-current-auth-session';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Text } from '@/components/layout';
import { AuthNavbar } from '@/components/authentication/auth-navbar';
import { setMemoryAccessToken } from '@/lib/token-storage-strategy.client';

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
      // Tokens already stored as httpOnly cookies by the callback route handler.
      // Just populate the in-memory access token so the tab can make API calls
      // immediately without waiting for the first 401 → refresh cycle.
      if (accessToken) setMemoryAccessToken(accessToken);
      localStorage.removeItem('sessionToken');
      document.cookie = `sessionToken=; path=/; Secure; SameSite=Lax; Max-Age=0`;

      router.push('/dashboard');
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
