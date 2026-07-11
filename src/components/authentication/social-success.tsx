'use client';

import { useAuthenticationFlowControl } from '@/hooks/authentication/use-authentication-flow-control';
import { useCurrentAuthSession } from '@/hooks/authentication/use-current-auth-session';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card } from '@vinta-schedule/design-system/ui/card';
import { AuthLayout } from '@vinta-schedule/design-system/layout/auth-layout';
import { Text } from '@vinta-schedule/design-system/layout';
import { AuthNavbar } from '@/components/authentication/auth-navbar';
import { setMemoryAccessToken } from '@/lib/token-storage-strategy.client';
import type { TenantBranding } from '@/lib/branding-shared';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';

export interface SocialSuccessProps {
  /**
   * Whether an allauth session is in progress. The token itself stays in the
   * httpOnly cookie (the /api/allauth proxy attaches it) — never pass it to
   * client code.
   */
  hasPendingSession?: boolean;
  accessToken?: string;
  refreshToken?: string;
  /** Resolved tenant branding. Defaults to vinta branding when absent. */
  branding?: TenantBranding;
}

export function SocialSuccess({
  hasPendingSession,
  accessToken,
  refreshToken,
  branding = VINTA_DEFAULT_BRANDING,
}: SocialSuccessProps) {
  const router = useRouter();
  const isAuthenticated = Boolean(accessToken);

  const { session, error: sessionError } = useCurrentAuthSession({
    enabled: Boolean(hasPendingSession) && !isAuthenticated,
  });
  const authenticationFlowControl = useAuthenticationFlowControl(router);

  useEffect(() => {
    if (isAuthenticated) {
      // Tokens already stored as httpOnly cookies by the callback route handler.
      // Just populate the in-memory access token so the tab can make API calls
      // immediately without waiting for the first 401 → refresh cycle.
      if (accessToken) setMemoryAccessToken(accessToken);
      // The session token stays in its httpOnly cookie (set by the callback
      // route) — account-management endpoints reach it via the proxy.

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
    hasPendingSession,
    authenticationFlowControl,
    router,
  ]);

  return (
    <AuthLayout navbar={<AuthNavbar branding={branding} />} variant='single'>
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
