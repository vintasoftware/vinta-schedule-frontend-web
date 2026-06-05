'use client';

import { useRouter } from 'next/navigation';
import { useVerifyPhone } from '@/hooks/authentication/use-verify-phone';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AuthLayout } from '@/components/layout/auth-layout';
import { VStack, Text, Heading } from '@/components/layout';
import { AuthNavbar } from '@/components/authentication/auth-navbar';
import { BackLink } from '@/components/authentication/back-link';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';
import { useAuthenticationFlowControl } from '@/hooks/authentication/use-authentication-flow-control';
import { useResendPhoneVerificationCode } from '@/hooks/authentication/use-resend-phone-verification-code';
import { syncSessionTokenFromCookie } from '@/lib/session-token';

export default function VerifyPhonePage() {
  const router = useRouter();
  // When reached via a server redirect (e.g. the social callback's
  // `verify_phone` 401), the freshest session token is in the cookie, not yet
  // in localStorage. Bridge it before the verify hook reads it. Runs once.
  useState(() => syncSessionTokenFromCookie());
  const authenticationFlowControl = useAuthenticationFlowControl(router);
  const { verifyPhone, verifyPhoneMutation } = useVerifyPhone();
  const { resendPhoneVerificationCode, resendPhoneVerificationCodeMutation } =
    useResendPhoneVerificationCode();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (otp.length !== 8) {
      setError('Please enter the 8-digit code.');
      return;
    }
    try {
      const response = await verifyPhone({ code: otp });
      authenticationFlowControl(response);
    } catch (err) {
      authenticationFlowControl(err);
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  return (
    <AuthLayout navbar={<AuthNavbar />} variant='single'>
      <Card className='w-full max-w-sm space-y-6 p-8'>
        <BackLink href='/auth/login' label='Back to login' />
        <form onSubmit={handleSubmit} className='space-y-6'>
          <Heading level={1} size='2xl' align='center'>
            Verify Phone
          </Heading>
          <VStack align='center' gap={4}>
            <InputOTP
              maxLength={8}
              value={otp}
              onChange={setOtp}
              containerClassName='justify-center'
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
                <InputOTPSlot index={6} />
                <InputOTPSlot index={7} />
              </InputOTPGroup>
            </InputOTP>

            {resendMessage && (
              <Alert
                variant={
                  resendMessage.startsWith('Verification code')
                    ? 'default'
                    : 'destructive'
                }
              >
                <AlertTitle>
                  {resendMessage.startsWith('Verification code')
                    ? 'Success'
                    : 'Error'}
                </AlertTitle>
                <AlertDescription>{resendMessage}</AlertDescription>
              </Alert>
            )}
          </VStack>
          {error && (
            <Alert variant='destructive'>
              <AlertTitle>Verification failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert variant='default'>
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          <Button
            type='submit'
            className='w-full'
            disabled={verifyPhoneMutation.isPending}
          >
            {verifyPhoneMutation.isPending ? 'Verifying...' : 'Verify'}
          </Button>
          <Text as='div' size='sm' align='center' className='mt-2'>
            <a
              href=''
              role='button'
              onClick={async (e) => {
                e.preventDefault();
                setResendMessage(null);
                try {
                  await resendPhoneVerificationCode();
                  setResendMessage('Verification code resent to your phone.');
                } catch (err) {
                  setResendMessage(
                    err instanceof Error ? err.message : 'Failed to resend code'
                  );
                }
              }}
              className='text-primary hover:underline'
            >
              {resendPhoneVerificationCodeMutation.isPending
                ? 'Resending...'
                : 'Resend Code'}
            </a>
          </Text>
        </form>
      </Card>
    </AuthLayout>
  );
}
