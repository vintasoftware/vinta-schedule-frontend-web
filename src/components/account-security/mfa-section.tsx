'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { VStack, HStack, Text } from '@/components/layout';

import { useAuthConfig } from '@/hooks/authentication/use-auth-config';
import { useTotpConfig } from '@/hooks/authentication/use-totp-config';
import { useDeactivateTotp } from '@/hooks/authentication/use-deactivate-totp';
import { useSensitiveAction } from '@/hooks/authentication/use-sensitive-action';
import { ReauthenticateDialog } from './reauthenticate-dialog';
import { TotpSetupDialog } from './totp-setup-dialog';
import { RecoveryCodesDialog } from './recovery-codes-dialog';

/**
 * Two-factor authentication: TOTP authenticator app + recovery codes.
 * Works for social-signup users too — no password required.
 */
export function MfaSection() {
  const { authConfig, isLoading: isConfigLoading } = useAuthConfig();
  const { isTotpActive, setupData, isLoading, isError } = useTotpConfig();
  const { deactivateTotp, deactivateTotpMutation } = useDeactivateTotp();
  const { runSensitive, reauthenticationRequest } = useSensitiveAction();

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isRecoveryCodesOpen, setIsRecoveryCodesOpen] = useState(false);
  const [isDeactivateConfirmOpen, setIsDeactivateConfirmOpen] = useState(false);

  const supportedTypes = authConfig?.data?.mfa?.supported_types ?? [];
  if (!isConfigLoading && !supportedTypes.includes('totp')) {
    return null; // MFA disabled in this environment
  }

  const handleDeactivate = async () => {
    setIsDeactivateConfirmOpen(false);
    try {
      const result = await runSensitive(() => deactivateTotp());
      if (result === undefined) return;
      toast.success('Two-factor authentication disabled.');
    } catch {
      toast.error('Could not disable two-factor authentication.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
        <CardDescription>
          Require a code from an authenticator app when logging in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || isConfigLoading ? (
          <Skeleton className='h-10 w-full' />
        ) : isError ? (
          <Text size='sm' color='destructive'>
            Could not load your two-factor settings.
          </Text>
        ) : isTotpActive ? (
          <VStack gap={4}>
            <HStack justify='between' align='center' gap={4}>
              <HStack align='center' gap={2}>
                <Text weight='medium'>Authenticator app</Text>
                <Badge variant='secondary'>Enabled</Badge>
              </HStack>
              <Button
                variant='ghost'
                size='sm'
                disabled={deactivateTotpMutation.isPending}
                onClick={() => setIsDeactivateConfirmOpen(true)}
              >
                Disable
              </Button>
            </HStack>
            {supportedTypes.includes('recovery_codes') && (
              <HStack justify='between' align='center' gap={4}>
                <Text size='sm' color='muted-foreground'>
                  Recovery codes let you log in if you lose your authenticator.
                </Text>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setIsRecoveryCodesOpen(true)}
                >
                  View codes
                </Button>
              </HStack>
            )}
          </VStack>
        ) : (
          <HStack justify='between' align='center' gap={4}>
            <Text size='sm' color='muted-foreground'>
              Two-factor authentication is currently disabled.
            </Text>
            <Button
              size='sm'
              disabled={!setupData}
              onClick={() => setIsSetupOpen(true)}
            >
              Enable
            </Button>
          </HStack>
        )}
      </CardContent>

      {setupData && (
        <TotpSetupDialog
          open={isSetupOpen}
          onOpenChange={setIsSetupOpen}
          setupData={setupData}
          onActivated={() => {
            setIsSetupOpen(false);
            // Push the user to store their recovery codes right away.
            if (supportedTypes.includes('recovery_codes')) {
              setIsRecoveryCodesOpen(true);
            }
          }}
        />
      )}
      <RecoveryCodesDialog
        open={isRecoveryCodesOpen}
        onOpenChange={setIsRecoveryCodesOpen}
      />

      <AlertDialog
        open={isDeactivateConfirmOpen}
        onOpenChange={setIsDeactivateConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disable two-factor authentication?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your account will no longer require an authenticator code at
              login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReauthenticateDialog request={reauthenticationRequest} />
    </Card>
  );
}
