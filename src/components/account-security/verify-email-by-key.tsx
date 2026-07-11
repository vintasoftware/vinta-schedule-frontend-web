'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Card } from 'vinta-schedule-design-system/ui/card';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { VStack, Text, Heading } from 'vinta-schedule-design-system/layout';

import { useVerifyEmail } from '@/hooks/authentication/use-verify-email';
import { useAuthenticationFlowControl } from '@/hooks/authentication/use-authentication-flow-control';
import { isAllauthBadRequest } from '@/lib/allauth-form-errors';
import { syncSessionTokenFromCookie } from '@/lib/session-token';

export interface VerifyEmailByKeyProps {
  verificationKey: string;
}

/**
 * Auto-submits the verification key from an emailed link
 * (`/account/verify-email/[key]`). When verification continues a login flow,
 * the shared dispatcher routes to the next step; otherwise we land on a
 * static success/failure card.
 */
export function VerifyEmailByKey({ verificationKey }: VerifyEmailByKeyProps) {
  const router = useRouter();
  const { verifyEmail } = useVerifyEmail();
  const authenticationFlowControl = useAuthenticationFlowControl(router);
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>(
    'pending'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    syncSessionTokenFromCookie();

    verifyEmail({ key: verificationKey })
      .then(async (response) => {
        setStatus('success');
        // Mid-login verification continues the pending flow (e.g. straight
        // into the app); outside a flow this is a no-op redirect-less success.
        if (response && typeof response === 'object' && 'meta' in response) {
          await authenticationFlowControl(response);
        }
      })
      .catch((error) => {
        setStatus('error');
        if (isAllauthBadRequest(error) && error.errors[0]) {
          setErrorMessage(error.errors[0].message);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationKey]);

  return (
    <Card className='w-full max-w-sm space-y-6 p-8'>
      <VStack gap={4} align='center'>
        <Heading level={1} size='2xl' align='center'>
          Email verification
        </Heading>
        {status === 'pending' && (
          <Text color='muted-foreground' align='center'>
            Verifying your email address…
          </Text>
        )}
        {status === 'success' && (
          <>
            <Text align='center'>Your email address has been verified.</Text>
            <Button asChild>
              <Link href='/auth/login'>Continue to login</Link>
            </Button>
          </>
        )}
        {status === 'error' && (
          <>
            <Text color='destructive' align='center' role='alert'>
              {errorMessage ??
                'This verification link is invalid or has expired.'}
            </Text>
            <Button asChild variant='outline'>
              <Link href='/auth/login'>Back to login</Link>
            </Button>
          </>
        )}
      </VStack>
    </Card>
  );
}
