'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'vinta-schedule-design-system/ui/dialog';
import { Button } from 'vinta-schedule-design-system/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from 'vinta-schedule-design-system/ui/input-otp';
import { VStack, Text, FormLayout } from 'vinta-schedule-design-system/layout';

import { useVerifyPhone } from '@/hooks/authentication/use-verify-phone';
import { useResendPhoneVerificationCode } from '@/hooks/authentication/use-resend-phone-verification-code';
import { ACCOUNT_PHONE_QUERY_KEY } from '@/hooks/authentication/use-account-phone';
import { isAllauthBadRequest } from '@/lib/allauth-form-errors';

const MAX_ATTEMPTS = 3;

export interface PhoneVerifyDialogProps {
  /** Number being verified; `null` keeps the dialog closed. */
  phone: string | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Enter the SMS OTP for a new/changed phone number. The backend allows at
 * most 3 attempts per code — once exhausted, the input is disabled until the
 * user requests a new code.
 */
export function PhoneVerifyDialog({
  phone,
  onOpenChange,
}: PhoneVerifyDialogProps) {
  const queryClient = useQueryClient();
  const { verifyPhone, verifyPhoneMutation } = useVerifyPhone();
  const { resendPhoneVerificationCode, resendPhoneVerificationCodeMutation } =
    useResendPhoneVerificationCode();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const attemptsExhausted = failedAttempts >= MAX_ATTEMPTS;

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await verifyPhone({ code });
    } catch (verifyError) {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      setCode('');
      const message =
        isAllauthBadRequest(verifyError) && verifyError.errors[0]
          ? verifyError.errors[0].message
          : 'Incorrect code.';
      setError(
        attempts >= MAX_ATTEMPTS
          ? `${message} No attempts left — request a new code.`
          : `${message} ${MAX_ATTEMPTS - attempts} attempt${MAX_ATTEMPTS - attempts === 1 ? '' : 's'} left.`
      );
      return;
    }
    queryClient.invalidateQueries({ queryKey: ACCOUNT_PHONE_QUERY_KEY });
    toast.success(`${phone} verified.`);
    setCode('');
    setFailedAttempts(0);
    onOpenChange(false);
  };

  const handleResend = async () => {
    setError(null);
    try {
      await resendPhoneVerificationCode();
      setFailedAttempts(0);
      setCode('');
      toast.success(`New verification code sent to ${phone}.`);
    } catch {
      toast.error('Could not resend the code. Please try again.');
    }
  };

  return (
    <Dialog open={Boolean(phone)} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Verify {phone}</DialogTitle>
          <DialogDescription>
            Enter the 8-digit code we texted to this number.
          </DialogDescription>
        </DialogHeader>
        <FormLayout onSubmit={handleVerify}>
          <VStack gap={4} align='center'>
            <InputOTP
              maxLength={8}
              value={code}
              onChange={(value) => {
                setCode(value);
                setError(null);
              }}
              disabled={attemptsExhausted}
              containerClassName='justify-center'
              aria-label='SMS verification code'
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
            {error && (
              <Text size='sm' color='destructive' role='alert' align='center'>
                {error}
              </Text>
            )}
            <Button
              type='button'
              variant='link'
              size='sm'
              onClick={handleResend}
              disabled={resendPhoneVerificationCodeMutation.isPending}
            >
              {resendPhoneVerificationCodeMutation.isPending
                ? 'Resending…'
                : 'Resend code'}
            </Button>
            {/* DialogFooter (shadcn) has no width prop; it must span the
                centered stack. */}
            <DialogFooter className='w-full'>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={
                  attemptsExhausted ||
                  code.length !== 8 ||
                  verifyPhoneMutation.isPending
                }
              >
                {verifyPhoneMutation.isPending ? 'Verifying…' : 'Verify'}
              </Button>
            </DialogFooter>
          </VStack>
        </FormLayout>
      </DialogContent>
    </Dialog>
  );
}
