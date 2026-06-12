'use client';

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
import { Skeleton } from '@/components/ui/skeleton';
import { VStack, Text } from '@/components/layout';

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
          <Skeleton className='h-32 w-full' />
        ) : isError ? (
          <Text size='sm' color='destructive'>
            Could not load your recovery codes.
          </Text>
        ) : (
          <VStack gap={3}>
            <div className='bg-muted grid grid-cols-2 gap-2 rounded-md p-4 font-mono text-sm'>
              {codes.map((code) => (
                <span key={code} className='select-all'>
                  {code}
                </span>
              ))}
              {codes.length === 0 && (
                <Text size='sm' color='muted-foreground' className='col-span-2'>
                  No unused codes left — regenerate a new set.
                </Text>
              )}
            </div>
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
