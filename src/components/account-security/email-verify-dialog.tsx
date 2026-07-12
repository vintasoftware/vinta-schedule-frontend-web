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
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Label } from 'vinta-schedule-design-system/ui/label';
import { VStack, Text, FormLayout } from 'vinta-schedule-design-system/layout';

import { useVerifyEmail } from '@/hooks/authentication/use-verify-email';
import { ACCOUNT_EMAILS_QUERY_KEY } from '@/hooks/authentication/use-account-emails';
import { isAllauthBadRequest } from '@/lib/allauth-form-errors';

export interface EmailVerifyDialogProps {
  /** Address being verified; `null` keeps the dialog closed. */
  email: string | null;
  onOpenChange: (open: boolean) => void;
}

/** Enter the emailed verification code for a newly added address. */
export function EmailVerifyDialog({
  email,
  onOpenChange,
}: EmailVerifyDialogProps) {
  const queryClient = useQueryClient();
  const { verifyEmail, verifyEmailMutation } = useVerifyEmail();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await verifyEmail({ key: code });
    } catch (verifyError) {
      if (isAllauthBadRequest(verifyError) && verifyError.errors[0]) {
        setError(verifyError.errors[0].message);
      } else {
        setError('Invalid or expired code. Please try again.');
      }
      return;
    }
    queryClient.invalidateQueries({ queryKey: ACCOUNT_EMAILS_QUERY_KEY });
    toast.success(`${email} verified.`);
    setCode('');
    onOpenChange(false);
  };

  return (
    <Dialog open={Boolean(email)} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Verify {email}</DialogTitle>
          <DialogDescription>
            Enter the verification code we sent to this address.
          </DialogDescription>
        </DialogHeader>
        <FormLayout onSubmit={handleVerify}>
          <VStack gap={4}>
            <VStack gap={2}>
              <Label htmlFor='email-verify-code'>Verification code</Label>
              <Input
                id='email-verify-code'
                autoComplete='one-time-code'
                autoFocus
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
              />
            </VStack>
            {error && (
              <Text size='sm' color='destructive' role='alert'>
                {error}
              </Text>
            )}
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={!code || verifyEmailMutation.isPending}
              >
                {verifyEmailMutation.isPending ? 'Verifying…' : 'Verify'}
              </Button>
            </DialogFooter>
          </VStack>
        </FormLayout>
      </DialogContent>
    </Dialog>
  );
}
