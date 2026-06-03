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
import { BackLink } from '@/components/authentication/back-link';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';
import { useAuthenticationFlowControl } from '@/hooks/authentication/use-authentication-flow-control';
import { useResendPhoneVerificationCode } from '@/hooks/authentication/use-resend-phone-verification-code';

export default function VerifyPhonePage() {
  const router = useRouter();
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
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code.');
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
    <div className='bg-muted flex min-h-screen items-center justify-center'>
      <Card className='w-full max-w-sm space-y-6 p-8'>
        <BackLink href='/auth/login' label='Back to login' />
        <form onSubmit={handleSubmit} className='space-y-6'>
          <h1 className='text-center text-2xl font-bold'>Verify Phone</h1>
          <div className='flex flex-col items-center gap-4'>
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
              containerClassName='justify-center'
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
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
          </div>
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
          <div className='mt-2 text-center text-sm'>
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
              className='text-blue-600 hover:underline'
            >
              {resendPhoneVerificationCodeMutation.isPending
                ? 'Resending...'
                : 'Resend Code'}
            </a>
          </div>
        </form>
      </Card>
    </div>
  );
}
