'use client';

/**
 * ActiveAddOnsList — the organization's active add-ons (Phase 4), read off the
 * subscription's `add_ons[]` (there is no separate add-ons list endpoint).
 *
 * Each RECURRING add-on exposes a "Stop renewing" action that DELETEs it
 * (`useCancelAddOn`), which stops it renewing at period end — the granted
 * capacity stays for the current period. One-time packs are not renewable, so
 * they show no such action.
 *
 * Capability gating is defense-in-depth: the "Stop renewing" action renders
 * only for members who hold `payments.manage_billing`; the server `403` on the
 * DELETE is the real gate. The list of add-ons is itself a read, so a member
 * still sees what the org owns — they just can't manage it.
 *
 * The `useCancelAddOn` mutation lives in the per-row `StopRenewingAction`, not
 * at the list root, so a subscription with no add-ons (or a non-admin viewer)
 * never instantiates the mutation — the list returns `null` before any row
 * mounts.
 */

import * as React from 'react';
import { RefreshCcw, TriangleAlert } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'vinta-schedule-design-system/ui/alert-dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Card, CardContent } from 'vinta-schedule-design-system/ui/card';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { HStack, Text, VStack } from 'vinta-schedule-design-system/layout';

import type { SubscriptionAddOn } from '@/client';
import { useSubscription } from '@/hooks/billing/use-subscription';
import { useCancelAddOn } from '@/hooks/billing/use-cancel-add-on';
import {
  useHasPermission,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';
import { resourceLabel } from '@/lib/billing/resource-labels';

/**
 * The "Stop renewing" confirm + DELETE for one recurring add-on. Owns the
 * `useCancelAddOn` mutation so it is only instantiated when a recurring add-on
 * is actually rendered for an admin.
 */
function StopRenewingAction({ addOn }: { addOn: SubscriptionAddOn }) {
  const { cancelAddOn, cancelAddOnMutation } = useCancelAddOn();
  const [open, setOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const label = resourceLabel(addOn.resource_key);

  const handleConfirm = async () => {
    setErrorMessage(null);
    try {
      await cancelAddOn(addOn.id);
      setOpen(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "We couldn't stop this add-on from renewing. Please try again."
      );
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          data-testid={`stop-renewing-${addOn.id}`}
        >
          <Icon icon={RefreshCcw} size='xs' /> Stop renewing
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop renewing this add-on?</AlertDialogTitle>
          <AlertDialogDescription>
            Your extra {label.toLowerCase()} capacity stays active until the end
            of the current billing period, then this add-on won&apos;t renew.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {errorMessage !== null && (
          <Alert
            variant='destructive'
            data-testid={`stop-renewing-error-${addOn.id}`}
          >
            <Icon icon={TriangleAlert} />
            <AlertTitle>We couldn&apos;t update this add-on</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancelAddOnMutation.isPending}>
            Keep renewing
          </AlertDialogCancel>
          <AlertDialogAction
            variant='destructive'
            onClick={(event) => {
              // Keep the dialog open until the mutation settles (or errors) —
              // the default action closes it, which we don't want mid-request.
              event.preventDefault();
              void handleConfirm();
            }}
            disabled={cancelAddOnMutation.isPending}
            data-testid={`confirm-stop-renewing-${addOn.id}`}
          >
            {cancelAddOnMutation.isPending ? 'Stopping…' : 'Stop renewing'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** One add-on's summary row. */
function AddOnRow({
  addOn,
  canManage,
}: {
  addOn: SubscriptionAddOn;
  canManage: boolean;
}) {
  const label = resourceLabel(addOn.resource_key);

  return (
    <Card data-testid='active-add-on-row' data-add-on-id={addOn.id}>
      <CardContent className='pt-6'>
        <HStack justify='between' gap={4} align='center' wrap>
          <VStack gap={1} align='start'>
            <Text weight='medium'>
              {addOn.quantity} × {label}
            </Text>
            <HStack gap={2} align='center'>
              {addOn.is_recurring ? (
                <Badge variant='info' data-testid='add-on-recurring-badge'>
                  Recurring
                </Badge>
              ) : (
                <Badge variant='teal' data-testid='add-on-one-time-badge'>
                  One-time pack
                </Badge>
              )}
              {addOn.is_active ? (
                <Badge variant='success'>Active</Badge>
              ) : (
                <Badge variant='warning'>Pending</Badge>
              )}
            </HStack>
          </VStack>

          {canManage && addOn.is_recurring ? (
            <StopRenewingAction addOn={addOn} />
          ) : null}
        </HStack>
      </CardContent>
    </Card>
  );
}

export function ActiveAddOnsList() {
  const { subscription } = useSubscription();
  const canManageBilling = useHasPermission(PERMISSIONS.manageBilling);

  const addOns = subscription?.add_ons ?? [];
  if (addOns.length === 0) {
    // Nothing to manage — render nothing so the overview stays clean.
    return null;
  }

  return (
    <VStack gap={3} align='stretch' data-testid='active-add-ons-list'>
      <Text weight='semibold'>Add-ons</Text>
      {addOns.map((addOn) => (
        <AddOnRow key={addOn.id} addOn={addOn} canManage={canManageBilling} />
      ))}
    </VStack>
  );
}
