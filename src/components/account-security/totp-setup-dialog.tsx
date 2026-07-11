'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@vinta-schedule/design-system/ui/dialog';
import { Button } from '@vinta-schedule/design-system/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@vinta-schedule/design-system/ui/input-otp';
import { VStack, Text } from '@vinta-schedule/design-system/layout';

import { TotpSetupData } from '@/hooks/authentication/use-totp-config';
import { useActivateTotp } from '@/hooks/authentication/use-activate-totp';
import { isAllauthBadRequest } from '@/lib/allauth-form-errors';

export interface TotpSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setupData: TotpSetupData;
  /** Called after successful activation, e.g. to show recovery codes. */
  onActivated: () => void;
}

/** Scan-QR → enter first code → activate TOTP. */
export function TotpSetupDialog({
  open,
  onOpenChange,
  setupData,
  onActivated,
}: TotpSetupDialogProps) {
  const { activateTotp, activateTotpMutation } = useActivateTotp();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    setError(null);
    try {
      await activateTotp(code);
    } catch (activationError) {
      if (isAllauthBadRequest(activationError) && activationError.errors[0]) {
        setError(activationError.errors[0].message);
      } else {
        setError('Could not activate the authenticator. Please try again.');
      }
      return;
    }
    toast.success('Two-factor authentication enabled.');
    setCode('');
    onActivated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Set up authenticator app</DialogTitle>
          <DialogDescription>
            Scan the QR code with your authenticator app (or enter the secret
            manually), then type the 6-digit code it shows.
          </DialogDescription>
        </DialogHeader>
        <VStack gap={4} align='center'>
          <div className='bg-card rounded-md border p-4'>
            <QRCodeSVG value={setupData.totp_url} size={176} marginSize={1} />
          </div>
          <VStack gap={1} align='center'>
            <Text size='sm' color='muted-foreground'>
              Manual entry secret
            </Text>
            <Text size='sm' className='font-mono break-all select-all'>
              {setupData.secret}
            </Text>
          </VStack>
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(value) => {
              setCode(value);
              setError(null);
            }}
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
          {error && (
            <Text size='sm' color='destructive' role='alert'>
              {error}
            </Text>
          )}
        </VStack>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleActivate}
            disabled={code.length !== 6 || activateTotpMutation.isPending}
          >
            {activateTotpMutation.isPending ? 'Activating…' : 'Activate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
