'use client';

import { useRouter } from 'next/navigation';
import { useVerifyPhone } from '@/hooks/authentication/use-verify-phone';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@vinta-schedule/design-system/ui/input-otp';
import { Button } from '@vinta-schedule/design-system/ui/button';
import { Card } from '@vinta-schedule/design-system/ui/card';
import { AuthLayout } from '@vinta-schedule/design-system/layout/auth-layout';
import { VStack, Text, Heading } from '@vinta-schedule/design-system/layout';
import { AuthNavbar } from '@/components/authentication/auth-navbar';
import { BackLink } from '@/components/authentication/back-link';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '@vinta-schedule/design-system/ui/alert';
import { useState } from 'react';
import type { ConsentCreate, UserConsent } from '@/client';
import { useAuthenticationFlowControl } from '@/hooks/authentication/use-authentication-flow-control';
import { useResendPhoneVerificationCode } from '@/hooks/authentication/use-resend-phone-verification-code';
import { useAccountPhone } from '@/hooks/authentication/use-account-phone';
import { useCreateConsent } from '@/hooks/consents/use-create-consent';
import { isConsentRequiredError } from '@/lib/consent-errors';
import { syncSessionTokenFromCookie } from '@/lib/session-token';

const CONSENT_RECOVERY_MESSAGE = 'Recording your SMS consent and retrying…';

const CONSENT_PHONE_MISSING_MESSAGE =
  "We couldn't automatically record your SMS consent because no phone " +
  'number was found on your account. Please re-initiate phone setup.';

const CONSENT_PHONE_LOADING_MESSAGE =
  'Still loading your account details — please try again in a moment.';

/**
 * A synthetic, client-side-only error: it never touched the API, so it must
 * never be routed through `authenticationFlowControl` (which expects errors
 * that came back from an actual request).
 */
class ConsentPhoneMissingError extends Error {}

/**
 * Recover from a `403 consent_required` response: record `sms_consent` for
 * the phone under verification, then retry the original request ONCE.
 *
 * - If no phone is available, throws a `ConsentPhoneMissingError` immediately
 *   (no consent recorded, no retry) — the caller must not silently treat this
 *   as success, and must not route it through auth-flow control since it
 *   never touched the API. The message distinguishes "still loading" from
 *   "genuinely missing".
 * - The single `retryRequest()` call is the only retry attempt; any error it
 *   throws (including `consent_required` again) propagates to the caller,
 *   which must NOT call this helper again — that's the infinite-loop guard.
 */
async function recoverFromConsentRequired<T>(
  retryRequest: () => Promise<T>,
  phone: string | undefined,
  isPhoneLoading: boolean,
  createConsent: (body: ConsentCreate) => Promise<UserConsent>,
  onRecovering: () => void
): Promise<T> {
  if (!phone) {
    throw new ConsentPhoneMissingError(
      isPhoneLoading
        ? CONSENT_PHONE_LOADING_MESSAGE
        : CONSENT_PHONE_MISSING_MESSAGE
    );
  }
  onRecovering();
  await createConsent({ document_type: 'sms_consent', phone_number: phone });
  return retryRequest();
}

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
  const { phone, isLoading: isAccountPhoneLoading } = useAccountPhone();
  const { createConsent } = useCreateConsent();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [consentRecoveryMessage, setConsentRecoveryMessage] = useState<
    string | null
  >(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setConsentRecoveryMessage(null);
    if (otp.length !== 8) {
      setError('Please enter the 8-digit code.');
      return;
    }
    try {
      const response = await verifyPhone({ code: otp });
      authenticationFlowControl(response);
    } catch (err) {
      if (isConsentRequiredError(err)) {
        try {
          const response = await recoverFromConsentRequired(
            () => verifyPhone({ code: otp }),
            phone?.phone,
            isAccountPhoneLoading,
            createConsent,
            () => setConsentRecoveryMessage(CONSENT_RECOVERY_MESSAGE)
          );
          setConsentRecoveryMessage(null);
          authenticationFlowControl(response);
        } catch (retryErr) {
          setConsentRecoveryMessage(null);
          if (retryErr instanceof ConsentPhoneMissingError) {
            // Synthetic, client-side-only error — it never touched the API,
            // so it must not be routed through auth-flow control.
            setError(retryErr.message);
          } else {
            authenticationFlowControl(retryErr);
            setError(
              retryErr instanceof Error
                ? retryErr.message
                : 'Verification failed'
            );
          }
        }
        return;
      }
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

            {consentRecoveryMessage && (
              <Alert variant='default'>
                <AlertTitle>One moment</AlertTitle>
                <AlertDescription>{consentRecoveryMessage}</AlertDescription>
              </Alert>
            )}

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
                setConsentRecoveryMessage(null);
                try {
                  await resendPhoneVerificationCode();
                  setResendMessage('Verification code resent to your phone.');
                } catch (err) {
                  if (isConsentRequiredError(err)) {
                    try {
                      await recoverFromConsentRequired(
                        () => resendPhoneVerificationCode(),
                        phone?.phone,
                        isAccountPhoneLoading,
                        createConsent,
                        () =>
                          setConsentRecoveryMessage(CONSENT_RECOVERY_MESSAGE)
                      );
                      setConsentRecoveryMessage(null);
                      setResendMessage(
                        'Verification code resent to your phone.'
                      );
                    } catch (retryErr) {
                      setConsentRecoveryMessage(null);
                      setResendMessage(
                        retryErr instanceof Error
                          ? retryErr.message
                          : 'Failed to resend code'
                      );
                    }
                    return;
                  }
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
