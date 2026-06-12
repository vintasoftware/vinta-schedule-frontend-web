'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VStack, Text, Heading } from '@/components/layout';

import { useConnectProviderCallback } from '@/hooks/authentication/use-connect-provider-callback';

type CallbackMode =
  | { kind: 'connect'; provider: string; code: string; state: string }
  | { kind: 'connect-cancelled' }
  | { kind: 'login-error'; cancelled: boolean };

/**
 * Landing page for `/account/provider/callback` — two backend flows end here:
 *
 * 1. The social-connect OAuth dance (provider redirects back with
 *    `code` + `state`): finish it and return to the security settings.
 * 2. Social-login errors (backend redirects here with `error`): show a
 *    friendly error with a way back to login.
 */
export function ProviderConnectCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connectProviderCallback } = useConnectProviderCallback();
  const startedRef = useRef(false);

  // Classify the landing once, before the connect marker is consumed.
  const [mode] = useState<CallbackMode>(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const isConnectFlow = Boolean(sessionStorage.getItem('connectProvider'));
    const provider =
      searchParams.get('provider') ?? sessionStorage.getItem('connectProvider');

    if (errorParam || !code || !state || !provider) {
      return isConnectFlow
        ? { kind: 'connect-cancelled' }
        : { kind: 'login-error', cancelled: errorParam === 'cancelled' };
    }
    return { kind: 'connect', provider, code, state };
  });

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    sessionStorage.removeItem('connectProvider');

    if (mode.kind === 'connect-cancelled') {
      // The user aborted (or the provider errored) mid-connect — a
      // dismissal, not an app failure.
      toast.info('Social account connection was cancelled.');
      router.replace('/security');
      return;
    }
    if (mode.kind !== 'connect') return;

    connectProviderCallback({
      provider: mode.provider,
      code: mode.code,
      state: mode.state,
    })
      .then((result) => {
        if (result.outcome === 'connected') {
          toast.success('Social account connected.');
        } else if (result.outcome === 'cancelled') {
          toast.info('Social account connection was cancelled.');
        } else {
          toast.error(
            result.message ?? 'Could not connect the social account.'
          );
        }
        router.replace('/security');
      })
      .catch(() => {
        toast.error('Could not connect the social account.');
        router.replace('/security');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mode.kind === 'login-error') {
    return (
      <Card className='w-full max-w-sm space-y-6 p-8'>
        <VStack gap={4} align='center'>
          <Heading level={1} size='2xl' align='center'>
            Sign-in failed
          </Heading>
          <Text color='muted-foreground' align='center'>
            {mode.cancelled
              ? 'The social login was cancelled.'
              : 'Something went wrong during the social login.'}
          </Text>
          <Button asChild>
            <Link href='/auth/login'>Back to login</Link>
          </Button>
        </VStack>
      </Card>
    );
  }

  return (
    <VStack gap={2} align='center'>
      <Text weight='semibold'>Connecting…</Text>
      <Text color='muted-foreground'>
        Please wait while we finish connecting your account.
      </Text>
    </VStack>
  );
}
