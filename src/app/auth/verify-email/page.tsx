'use client';

import { useRouter } from 'next/navigation';
import { useVerifyEmail } from '@/hooks/authentication/use-verify-email';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from 'vinta-schedule-design-system/ui/input-otp';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Card } from 'vinta-schedule-design-system/ui/card';
import { AuthLayout } from 'vinta-schedule-design-system/layout/auth-layout';
import {
  Box,
  FormLayout,
  VStack,
  Text,
  Heading,
} from 'vinta-schedule-design-system/layout';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { AuthNavbar } from '@/components/authentication/auth-navbar';
import { BackLink } from '@/components/authentication/back-link';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'vinta-schedule-design-system/ui/alert';
import { useState } from 'react';
import { useAuthenticationFlowControl } from '@/hooks/authentication/use-authentication-flow-control';
import { useResendEmailVerificationCode } from '@/hooks/authentication/use-resend-email-verification-code';

export default function VerifyEmailPage() {
  const router = useRouter();
  const authenticationFlowControl = useAuthenticationFlowControl(router);
  const { verifyEmail, verifyEmailMutation } = useVerifyEmail();
  const { resendEmailVerificationCode, resendEmailVerificationCodeMutation } =
    useResendEmailVerificationCode();
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
      const response = await verifyEmail({ key: otp });
      authenticationFlowControl(response);
    } catch (err) {
      authenticationFlowControl(err);
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  return (
    <AuthLayout navbar={<AuthNavbar />} variant='single'>
      <Box maxWidth={384} mx='auto'>
        <Card padding={8}>
          <VStack gap={6}>
            <BackLink href='/auth/login' label='Back to login' />
            <FormLayout gap={6} onSubmit={handleSubmit}>
              <Heading level={1} size='2xl' align='center'>
                Verify Email
              </Heading>
              <VStack align='center' gap={4}>
                <InputOTP
                  maxLength={8}
                  value={otp}
                  onChange={setOtp}
                  // `containerClassName` is InputOTP's own slot-container hook;
                  // it takes no DS layout props.
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
              {/* `w-full`: <Button> exposes no width prop. */}
              <Button
                type='submit'
                className='w-full'
                disabled={verifyEmailMutation.isPending}
              >
                {verifyEmailMutation.isPending ? 'Verifying...' : 'Verify'}
              </Button>

              <Text as='div' size='sm' align='center' mt={2}>
                <TextLink
                  href=''
                  role='button'
                  onClick={async (e) => {
                    e.preventDefault();
                    setResendMessage(null);
                    try {
                      await resendEmailVerificationCode();
                      setResendMessage(
                        'Verification code resent to your email.'
                      );
                    } catch (err) {
                      setResendMessage(
                        err instanceof Error
                          ? err.message
                          : 'Failed to resend code'
                      );
                    }
                  }}
                >
                  {resendEmailVerificationCodeMutation.isPending
                    ? 'Resending...'
                    : 'Resend Code'}
                </TextLink>
              </Text>
            </FormLayout>
          </VStack>
        </Card>
      </Box>
    </AuthLayout>
  );
}
