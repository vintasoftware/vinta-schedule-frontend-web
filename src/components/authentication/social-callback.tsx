'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
    <div className='flex min-h-screen flex-col items-center justify-center'>
      <div className='mb-2 text-lg font-semibold'>Connecting...</div>
      <div className='text-gray-500'>
        Please wait while we finish your social login.
      </div>
    </div>
  );
}
