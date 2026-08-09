'use client';

/**
 * CancelSubscriptionDialog — confirm cancelling the org's paid plan (Phase 3).
 *
 * Cancellation is not immediate: the plan runs to the END of the current
 * billing period, then the org falls back to the free plan. The dialog says so
 * explicitly (and names the period-end date when known) so an admin isn't
 * surprised by keeping access until the cycle closes.
 *
 * On confirm it calls `useCancelSubscription` (which invalidates the
 * subscription + usage reads), then closes. A `409` (the stamped provider is
 * unconfigured, so the provider-side cancellation can't be driven) surfaces as
 * an inline error rather than a silent failure.
 */

import * as React from 'react';
import { TriangleAlert } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from 'vinta-schedule-design-system/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { Text, VStack } from 'vinta-schedule-design-system/layout';

import type { Subscription } from '@/client';
import { useCancelSubscription } from '@/hooks/billing/use-cancel-subscription';
import { formatPeriod } from '@/lib/billing/format';
import { readBillingConflict } from '@/lib/utils/api-errors';

export interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The subscription being cancelled; supplies the plan name + period end. */
  subscription: Subscription | null;
}

export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  subscription,
}: CancelSubscriptionDialogProps) {
  const { cancelSubscription, cancelSubscriptionMutation } =
    useCancelSubscription();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Clear a stale error from a previous attempt when the dialog (re)opens. This
  // is the render-phase "reset state on a prop change" pattern React recommends,
  // so a previous 409 doesn't linger the next time the dialog is shown.
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setErrorMessage(null);
    }
  }

  const isPending = cancelSubscriptionMutation.isPending;
  const planName = subscription?.plan.name ?? 'your plan';
  const periodEnd = subscription?.current_period_end ?? null;

  const handleConfirm = async () => {
    setErrorMessage(null);
    try {
      await cancelSubscription();
      onOpenChange(false);
    } catch (err) {
      const conflict = readBillingConflict(err);
      setErrorMessage(
        conflict?.detail ??
          (err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.')
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Cancel {planName}?</DialogTitle>
          <DialogDescription>
            You&apos;ll keep access until the end of your current billing
            period, then your organization moves to the free plan.
          </DialogDescription>
        </DialogHeader>

        <VStack gap={3} align='stretch'>
          {periodEnd !== null && (
            <Text
              size='sm'
              color='muted-foreground'
              data-testid='cancel-period-end'
            >
              Your paid plan stays active until {formatPeriod(periodEnd)}. After
              that you&apos;ll fall back to the free plan and its limits.
            </Text>
          )}

          {errorMessage !== null && (
            <Alert variant='destructive' data-testid='cancel-error'>
              <Icon icon={TriangleAlert} />
              <AlertTitle>We couldn&apos;t cancel your plan</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </VStack>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Keep my plan
          </Button>
          <Button
            type='button'
            variant='destructive'
            onClick={handleConfirm}
            disabled={isPending}
            data-testid='cancel-subscription-confirm'
          >
            {isPending ? 'Cancelling…' : 'Cancel plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
