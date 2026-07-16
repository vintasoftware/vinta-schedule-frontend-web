'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Center, Text } from 'vinta-schedule-design-system/layout';
import { useProviderLoginCallback } from '@/hooks/authentication/use-provider-login-callback';
import { useAuthenticationFlowControl } from '@/hooks/authentication/use-authentication-flow-control';
import { useCurrentAuthSession } from '@/hooks/authentication/use-current-auth-session';

export interface SocialCallbackProps {
  provider: string;
  params: Record<string, unknown>;
}

export function SocialCallback({ provider, params }: SocialCallbackProps) {
  const router = useRouter();
  const { providerLoginCallback, providerLoginCallbackMutation } =
    useProviderLoginCallback();
  const { session, error: sessionError } = useCurrentAuthSession({
    enabled: providerLoginCallbackMutation.isSuccess,
  });
  const authenticationFlowControl = useAuthenticationFlowControl(router);

  const handleCallback = useCallback(async () => {
    providerLoginCallback({
      provider,
      queryParams: params,
    });
  }, [providerLoginCallback, provider, params]);

  useEffect(() => {
    if (session) {
      authenticationFlowControl(session);
    }
    if (sessionError) {
      authenticationFlowControl(sessionError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, sessionError]);

  useEffect(() => {
    if (provider) {
      handleCallback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  return (
    <Center direction='column' minHeight='screen'>
      <Text as='div' size='lg' weight='semibold' mb={2}>
        Connecting...
      </Text>
      <Text as='div' color='muted-foreground'>
        Please wait while we finish your social login.
      </Text>
    </Center>
  );
}
