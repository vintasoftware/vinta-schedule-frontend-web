'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VStack, Text } from '@/components/layout';

import { ReauthenticationRequest } from '@/hooks/authentication/use-sensitive-action';
import { useReauthenticate } from '@/hooks/authentication/use-reauthenticate';
import { useMfaReauthenticate } from '@/hooks/authentication/use-mfa-reauthenticate';
import { isAllauthBadRequest } from '@/lib/allauth-form-errors';

export interface ReauthenticateDialogProps {
  request: ReauthenticationRequest | null;
}

/**
 * Confirms the user's identity when a sensitive operation answers 401 with a
 * pending reauthentication flow (paired with `useSensitiveAction`). Offers
 * password or MFA-code reauthentication depending on the flows the backend
 * listed, then retries the held action.
 */
export function ReauthenticateDialog({ request }: ReauthenticateDialogProps) {
  const { reauthenticate, reauthenticateMutation } = useReauthenticate();
  const { mfaReauthenticate, mfaReauthenticateMutation } =
    useMfaReauthenticate();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [method, setMethod] = useState<'password' | 'mfa' | null>(null);

  if (!request) return null;

  const canPassword = request.flows.includes('reauthenticate');
  const canMfa = request.flows.includes('mfa_reauthenticate');
  const activeMethod = method ?? (canPassword ? 'password' : 'mfa');
  const isPending =
    reauthenticateMutation.isPending || mfaReauthenticateMutation.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (activeMethod === 'password') {
        await reauthenticate({ password });
      } else {
        await mfaReauthenticate({ code });
      }
    } catch (error) {
      if (isAllauthBadRequest(error) && error.errors[0]) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Could not confirm your identity. Please try again.');
      }
      return;
    }
    setPassword('');
    setCode('');
    await request.retry();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) request.cancel();
      }}
    >
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Confirm it&apos;s you</DialogTitle>
          <DialogDescription>
            For your security, please confirm your identity to continue.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <VStack gap={4}>
            {activeMethod === 'password' ? (
              <VStack gap={2}>
                <Label htmlFor='reauth-password'>Password</Label>
                <Input
                  id='reauth-password'
                  type='password'
                  autoComplete='current-password'
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </VStack>
            ) : (
              <VStack gap={2}>
                <Label htmlFor='reauth-code'>Authenticator code</Label>
                <Input
                  id='reauth-code'
                  inputMode='numeric'
                  autoComplete='one-time-code'
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Text size='sm' color='muted-foreground'>
                  Enter a code from your authenticator app or a recovery code.
                </Text>
              </VStack>
            )}
            {canPassword && canMfa && (
              <Button
                type='button'
                variant='link'
                size='sm'
                className='self-start px-0'
                onClick={() =>
                  setMethod(activeMethod === 'password' ? 'mfa' : 'password')
                }
              >
                {activeMethod === 'password'
                  ? 'Use an authenticator code instead'
                  : 'Use your password instead'}
              </Button>
            )}
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => request.cancel()}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={
                  isPending || (activeMethod === 'password' ? !password : !code)
                }
              >
                {isPending ? 'Confirming…' : 'Confirm'}
              </Button>
            </DialogFooter>
          </VStack>
        </form>
      </DialogContent>
    </Dialog>
  );
}
