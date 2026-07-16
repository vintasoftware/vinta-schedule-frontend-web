'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from 'vinta-schedule-design-system/ui/button';
import { Card } from 'vinta-schedule-design-system/ui/card';
import { Input } from 'vinta-schedule-design-system/ui/input';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'vinta-schedule-design-system/ui/alert';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from 'vinta-schedule-design-system/ui/input-otp';
import { AuthLayout } from 'vinta-schedule-design-system/layout/auth-layout';
import {
  Box,
  Center,
  FormLayout,
  VStack,
  Text,
  Heading,
} from 'vinta-schedule-design-system/layout';
import { AuthNavbar } from '@/components/authentication/auth-navbar';
import { BackLink } from '@/components/authentication/back-link';

import { useMfaAuthenticate } from '@/hooks/authentication/use-mfa-authenticate';
import { isAllauthBadRequest } from '@/lib/allauth-form-errors';
import { syncSessionTokenFromCookie } from '@/lib/session-token';

/**
 * MFA login challenge — reached when login answers 401 with a pending
 * `mfa_authenticate` flow. Accepts a TOTP code or a recovery code.
 */
export default function MfaAuthenticatePage() {
  const router = useRouter();
  // When reached via a server redirect the freshest session token is in the
  // cookie, not yet in localStorage. Bridge it before submitting. Runs once.
  useState(() => syncSessionTokenFromCookie());
  const { mfaAuthenticate, mfaAuthenticateMutation } = useMfaAuthenticate();
  const [code, setCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code) {
      setError('Please enter a code.');
      return;
    }
    try {
      await mfaAuthenticate({ code });
      router.push('/');
    } catch (err) {
      if (isAllauthBadRequest(err) && err.errors[0]) {
        setError(err.errors[0].message);
      } else {
        setError('Invalid code. Please try again.');
      }
      setCode('');
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
                Two-factor authentication
              </Heading>
              <Text color='muted-foreground' align='center'>
                {useRecoveryCode
                  ? 'Enter one of your recovery codes.'
                  : 'Enter the 6-digit code from your authenticator app.'}
              </Text>
              <VStack align='center' gap={4}>
                {useRecoveryCode ? (
                  <Input
                    aria-label='Recovery code'
                    autoComplete='one-time-code'
                    autoFocus
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setError(null);
                    }}
                  />
                ) : (
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(value) => {
                      setCode(value);
                      setError(null);
                    }}
                    // `containerClassName` is InputOTP's own slot-container
                    // hook; it takes no DS layout props.
                    containerClassName='justify-center'
                    aria-label='Authenticator code'
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                )}
              </VStack>
              {error && (
                <Alert variant='destructive'>
                  <AlertTitle>Verification failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {/* `w-full`: <Button> exposes no width prop. */}
              <Button
                type='submit'
                className='w-full'
                disabled={mfaAuthenticateMutation.isPending}
              >
                {mfaAuthenticateMutation.isPending ? 'Verifying...' : 'Verify'}
              </Button>
              <Center>
                <Button
                  type='button'
                  variant='link'
                  onClick={() => {
                    setUseRecoveryCode((value) => !value);
                    setCode('');
                    setError(null);
                  }}
                >
                  {useRecoveryCode
                    ? 'Use an authenticator code instead'
                    : 'Use a recovery code instead'}
                </Button>
              </Center>
            </FormLayout>
          </VStack>
        </Card>
      </Box>
    </AuthLayout>
  );
}
