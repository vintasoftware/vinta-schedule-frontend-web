'use client';

import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'vinta-schedule-design-system/ui/dialog';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Skeleton } from 'vinta-schedule-design-system/ui/skeleton';
import {
  Grid,
  GridItem,
  VStack,
  Text,
} from 'vinta-schedule-design-system/layout';

import { useRecoveryCodes } from '@/hooks/authentication/use-recovery-codes';
import { useRegenerateRecoveryCodes } from '@/hooks/authentication/use-regenerate-recovery-codes';
import { useSensitiveAction } from '@/hooks/authentication/use-sensitive-action';
import { ReauthenticateDialog } from './reauthenticate-dialog';

export interface RecoveryCodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** View remaining recovery codes and regenerate a fresh set. */
export function RecoveryCodesDialog({
  open,
  onOpenChange,
}: RecoveryCodesDialogProps) {
  const { recoveryCodes, isLoading, isError } = useRecoveryCodes({
    enabled: open,
  });
  const { regenerateRecoveryCodes, regenerateRecoveryCodesMutation } =
    useRegenerateRecoveryCodes();
  const { runSensitive, reauthenticationRequest } = useSensitiveAction();

  const codes = recoveryCodes?.unused_codes ?? [];

  const handleRegenerate = async () => {
    try {
      const result = await runSensitive(() => regenerateRecoveryCodes());
      if (result === undefined) return;
      toast.success('New recovery codes generated. Store them somewhere safe.');
    } catch {
      toast.error('Could not regenerate recovery codes. Please try again.');
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    toast.success('Recovery codes copied to clipboard.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Recovery codes</DialogTitle>
          <DialogDescription>
            Each code can be used once to log in if you lose access to your
            authenticator app. Store them somewhere safe.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton height={128} width='full' />
        ) : isError ? (
          <Text size='sm' color='destructive'>
            Could not load your recovery codes.
          </Text>
        ) : (
          <VStack gap={3}>
            <Grid columns={2} gap={2} p={4} radius='md' bg='muted'>
              {codes.map((code) => (
                // `select-all` (user-select) has no prop form — kept as a class.
                <Text key={code} size='sm' family='mono' className='select-all'>
                  {code}
                </Text>
              ))}
              {codes.length === 0 && (
                <GridItem span={2}>
                  <Text size='sm' color='muted-foreground'>
                    No unused codes left — regenerate a new set.
                  </Text>
                </GridItem>
              )}
            </Grid>
            <Text size='sm' color='muted-foreground'>
              {codes.length} unused code{codes.length === 1 ? '' : 's'}{' '}
              remaining.
            </Text>
          </VStack>
        )}
        <DialogFooter>
          {codes.length > 0 && (
            <Button variant='outline' onClick={handleCopy}>
              Copy
            </Button>
          )}
          <Button
            variant='outline'
            onClick={handleRegenerate}
            disabled={regenerateRecoveryCodesMutation.isPending}
          >
            {regenerateRecoveryCodesMutation.isPending
              ? 'Regenerating…'
              : 'Regenerate'}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
        <ReauthenticateDialog request={reauthenticationRequest} />
      </DialogContent>
    </Dialog>
  );
}
