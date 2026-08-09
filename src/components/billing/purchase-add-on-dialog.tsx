'use client';

/**
 * PurchaseAddOnDialog — buy additional capacity for a pre-paid resource
 * (Phase 4; Use-case 3). A MONEY-PATH surface built on the exact Phase-3
 * invariants (see change-plan-dialog.tsx). Three things carry the feature:
 *
 * 1. ONE idempotency key per user attempt, reused across every retry.
 *    A per-attempt `createIdempotencyKeyHolder` lives in a ref scoped to this
 *    component instance. The caller mounts a fresh PurchaseAddOnDialog per
 *    attempt (a per-attempt `key`), so a new attempt is a new mount with a new
 *    holder. Within one mount the lazy `.key` mints once and holds stable, so a
 *    400-then-retry (or a double-click) sends the SAME key — the API is
 *    idempotent per key, so this is what stops a double-charge.
 *
 * 2. Payment token only when the billing root has no instrument on file.
 *    We show `PaymentInstrumentField` up-front for a free / cancelled /
 *    subscription-less org (mirrors change-plan's `hasPaidInstrument`) and send
 *    the minted token; a returning (already-paying) org buys against its
 *    instrument on file without re-collecting a card. As a defensive backstop
 *    (the add-on 400 body is undocumented) a token-required 400 reveals the
 *    field and lets the user retry — reusing the same idempotency key.
 *
 * 3. Success is asynchronous — the UI polls, it never assumes.
 *    `POST /billing/add-ons/` returns `201` with the new add-on BEFORE the
 *    provider webhook grants capacity — `is_active` flips only then. On a
 *    successful initiate we enter `useAwaitPaymentConfirmation` (poll the
 *    subscription every ~3s for up to ~60s) and show a PENDING state until the
 *    RETURNED add-on's `is_active` is true. Critically, a not-yet-readable
 *    add-on — absent from `add_ons[]`, or an undefined subscription read — must
 *    KEEP POLLING, never settle as confirmed (see `isAddOnConfirmed`).
 *
 * Errors branch on the parsed body (throwOnError:true): `400`
 * `AddOnNotPurchasableError` (this resource can't be bought) via
 * `isAddOnNotPurchasableError`; `409` (provider unconfigured) via
 * `readBillingConflict`.
 */

import * as React from 'react';
import { CheckCircle2, Clock, Loader2, TriangleAlert } from 'lucide-react';

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
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Label } from 'vinta-schedule-design-system/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
} from 'vinta-schedule-design-system/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'vinta-schedule-design-system/ui/select';
import { Box, HStack, Text, VStack } from 'vinta-schedule-design-system/layout';

import type { ResourceKeyEnum, Subscription } from '@/client';
import { usePurchaseAddOn } from '@/hooks/billing/use-purchase-add-on';
import { useSubscription } from '@/hooks/billing/use-subscription';
import { useAwaitPaymentConfirmation } from '@/hooks/billing/use-await-payment-confirmation';
import { createIdempotencyKeyHolder } from '@/lib/billing/idempotency';
import { RESOURCE_LABELS, resourceLabel } from '@/lib/billing/resource-labels';
import type { PaymentProviderSdkFactory } from '@/lib/billing/payment-provider-sdk';
import type { PaymentInstrumentResult } from '@/lib/billing/payment-token';
import {
  isAddOnNotPurchasableError,
  isPaymentTokenRequiredError,
  readBillingConflict,
} from '@/lib/utils/api-errors';

import {
  PaymentInstrumentField,
  type PaymentInstrumentFieldHandle,
} from './payment-instrument-field';

type Phase = 'form' | 'confirming' | 'confirmed' | 'still_processing';

/** The resource keys offered when the dialog is opened without a preselection. */
const DEFAULT_RESOURCE_OPTIONS = Object.keys(
  RESOURCE_LABELS
) as ResourceKeyEnum[];

export interface PurchaseAddOnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Pre-selected resource — set when opened from a usage row's "Buy more". When
   * present the resource is FIXED (not selectable); when absent the user picks
   * from `resourceOptions`.
   */
  resourceKey?: ResourceKeyEnum;
  /** Selectable resources when `resourceKey` is absent (defaults to all keys). */
  resourceOptions?: ResourceKeyEnum[];
  /** The org's current subscription; `null` for a free / subscription-less org. */
  subscription: Subscription | null;
  /**
   * Injectable SDK factory forwarded to `PaymentInstrumentField` (stories/tests
   * pass a fake so no real provider script loads). Production leaves it default.
   */
  createSdk?: PaymentProviderSdkFactory;
}

/**
 * Whether the billing root already has a paid instrument attached. A free /
 * cancelled / subscription-less org does not, so it must supply a token
 * up-front; a returning (active/grace/restricted) org already has one on file.
 */
function hasPaidInstrument(subscription: Subscription | null): boolean {
  if (subscription === null) {
    return false;
  }
  return (
    subscription.billing_state !== 'free' &&
    subscription.billing_state !== 'cancelled'
  );
}

/**
 * The confirmation predicate: the purchase is settled ONLY once the RETURNED
 * add-on (found by the `id` the `201` gave us) appears in the refetched
 * subscription's `add_ons[]` AND its `is_active` is true.
 *
 * A missing/not-yet-readable add-on must NEVER resolve as confirmed:
 *   • an undefined subscription read (the post-initiate refetch resolving before
 *     the row is visible, or a free org's `404`), OR
 *   • an add-on absent from `add_ons[]` (the write is not yet readable), OR
 *   • the add-on present but `is_active` still false (webhook not landed)
 * all KEEP POLLING. Treating any of those as success would render "done" BEFORE
 * the webhook grants capacity — the exact money-path defect this guards.
 */
function isAddOnConfirmed(
  subscription: Subscription | null | undefined,
  addOnId: number | null
): boolean {
  if (subscription === null || subscription === undefined || addOnId === null) {
    return false;
  }
  const addOn = subscription.add_ons.find((row) => row.id === addOnId);
  if (addOn === undefined) {
    // Not yet readable in the pool — keep polling, never confirm.
    return false;
  }
  return addOn.is_active === true;
}

/** Maps a tokenization error to a user-facing message. */
function tokenizeErrorMessage(
  result: Extract<PaymentInstrumentResult, { status: 'error' }>
): string {
  if (result.reason === 'incomplete') {
    return 'Your card details are incomplete. Please check them and try again.';
  }
  return result.message;
}

export function PurchaseAddOnDialog({
  open,
  onOpenChange,
  resourceKey,
  resourceOptions = DEFAULT_RESOURCE_OPTIONS,
  subscription,
  createSdk,
}: PurchaseAddOnDialogProps) {
  const { purchaseAddOn, purchaseAddOnMutation } = usePurchaseAddOn();
  // Same query key as the parent's subscription read (shared cache); we use its
  // refetch as the confirmation poll.
  const { subscriptionQuery } = useSubscription();

  // The id of the add-on the `201` returned, read by the confirmation predicate.
  // A ref (not state) so the predicate reads the latest value without needing to
  // re-create the confirmation hook.
  const purchasedAddOnIdRef = React.useRef<number | null>(null);

  const confirmation = useAwaitPaymentConfirmation<
    Subscription | null | undefined
  >({
    poll: async () => {
      // Do NOT coalesce a missing/absent read into a resolvable sentinel: a
      // not-yet-readable subscription must keep polling, never settle.
      const { data } = await subscriptionQuery.refetch();
      return data;
    },
    isResolved: (value) => isAddOnConfirmed(value, purchasedAddOnIdRef.current),
  });

  // One key per attempt, reused across every retry within this attempt. Scoped
  // to this component instance: the caller mounts a fresh dialog per attempt
  // (per-attempt `key`), so a genuinely new attempt is a new mount with a new
  // holder. Within one mount the lazy `.key` mints once and holds stable across
  // the 400-then-retry path.
  const idempotencyHolderRef = React.useRef(createIdempotencyKeyHolder());

  const paymentFieldRef = React.useRef<PaymentInstrumentFieldHandle>(null);

  const [selectedResource, setSelectedResource] = React.useState<
    ResourceKeyEnum | ''
  >(resourceKey ?? resourceOptions[0] ?? '');
  const [quantity, setQuantity] = React.useState(1);
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>('form');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [showPaymentField, setShowPaymentField] = React.useState(
    () => !hasPaidInstrument(subscription)
  );

  const effectiveResource: ResourceKeyEnum | '' =
    resourceKey ?? selectedResource;
  const isPending = purchaseAddOnMutation.isPending;
  const canSubmit = effectiveResource !== '' && quantity >= 1;

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (effectiveResource === '') {
      setErrorMessage('Please choose a resource to purchase.');
      return;
    }
    if (quantity < 1) {
      setErrorMessage('Please enter a quantity of at least 1.');
      return;
    }

    let paymentToken: string | undefined;
    if (showPaymentField) {
      const handle = paymentFieldRef.current;
      if (handle === null) {
        setErrorMessage('The payment field is not ready. Please try again.');
        return;
      }
      const result = await handle.tokenize();
      if (result.status === 'error') {
        setErrorMessage(tokenizeErrorMessage(result));
        return;
      }
      paymentToken = result.token;
    }

    // Read the key ONCE per submit; the holder returns the same value on the
    // retry path below, so a token-then-retry reuses it (no double-charge).
    const idempotencyKey = idempotencyHolderRef.current.key;

    let addOn;
    try {
      addOn = await purchaseAddOn({
        resource_key: effectiveResource,
        quantity,
        is_recurring: isRecurring,
        idempotency_key: idempotencyKey,
        payment_token: paymentToken,
      });
    } catch (err) {
      if (isAddOnNotPurchasableError(err)) {
        setErrorMessage(
          `${resourceLabel(effectiveResource)} can't be purchased as an add-on.`
        );
        return;
      }
      if (isPaymentTokenRequiredError(err)) {
        // First-time instrument attach. Reveal the card field and let the user
        // retry — the idempotency holder is NOT reset, so the retry reuses the
        // same key.
        setShowPaymentField(true);
        setErrorMessage('Please add a payment method to continue.');
        return;
      }
      const conflict = readBillingConflict(err);
      if (conflict) {
        setErrorMessage(conflict.detail);
        return;
      }
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      );
      return;
    }

    // Record the returned add-on id so the predicate can find it in the poll,
    // then poll until the webhook flips `is_active` — never "done" off the 201.
    purchasedAddOnIdRef.current = addOn.id;
    setPhase('confirming');
    const result = await confirmation.start();
    setPhase(result.status === 'confirmed' ? 'confirmed' : 'still_processing');
  };

  const handleCheckAgain = async () => {
    setPhase('confirming');
    const result = await confirmation.start();
    setPhase(result.status === 'confirmed' ? 'confirmed' : 'still_processing');
  };

  const resourceName =
    effectiveResource === ''
      ? 'this resource'
      : resourceLabel(effectiveResource);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Buy more capacity</DialogTitle>
          <DialogDescription>
            Purchase additional capacity for a pre-paid resource. It activates
            once your payment is confirmed.
          </DialogDescription>
        </DialogHeader>

        {phase === 'confirming' && (
          <VStack
            gap={3}
            py={4}
            align='center'
            data-testid='purchase-add-on-confirming'
          >
            <Icon icon={Loader2} spin color='muted-foreground' />
            <Text weight='medium'>Confirming your payment…</Text>
            <Text size='sm' color='muted-foreground' align='center'>
              We&apos;re waiting for your payment provider to confirm the
              purchase. Your new capacity activates as soon as it does.
            </Text>
          </VStack>
        )}

        {phase === 'confirmed' && (
          <VStack
            gap={3}
            py={4}
            align='center'
            data-testid='purchase-add-on-confirmed'
          >
            <Icon icon={CheckCircle2} color='success' />
            <Text weight='medium'>Your add-on is active</Text>
            <Text size='sm' color='muted-foreground' align='center'>
              The extra {resourceName.toLowerCase()} capacity is now in effect.
            </Text>
            <DialogFooter>
              <Button type='button' onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </VStack>
        )}

        {phase === 'still_processing' && (
          <VStack
            gap={3}
            py={4}
            align='center'
            data-testid='purchase-add-on-still-processing'
          >
            <Icon icon={Clock} color='muted-foreground' />
            <Text weight='medium'>Still confirming your payment</Text>
            <Text size='sm' color='muted-foreground' align='center'>
              This is taking longer than usual. Your payment provider is still
              processing — you can check again in a moment, or close this and
              come back later.
            </Text>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button type='button' onClick={handleCheckAgain}>
                Check again
              </Button>
            </DialogFooter>
          </VStack>
        )}

        {phase === 'form' && (
          <VStack gap={4} align='stretch'>
            <VStack gap={2} align='stretch'>
              <Label htmlFor='add-on-resource'>Resource</Label>
              {resourceKey !== undefined ? (
                <Box
                  p={3}
                  radius='md'
                  border
                  bg='muted'
                  data-testid='add-on-resource-fixed'
                >
                  <Text weight='medium'>{resourceLabel(resourceKey)}</Text>
                </Box>
              ) : (
                <Select
                  value={selectedResource}
                  onValueChange={(value) =>
                    setSelectedResource(value as ResourceKeyEnum)
                  }
                >
                  <SelectTrigger
                    id='add-on-resource'
                    data-testid='add-on-resource-select'
                  >
                    <SelectValue placeholder='Choose a resource' />
                  </SelectTrigger>
                  <SelectContent>
                    {resourceOptions.map((key) => (
                      <SelectItem key={key} value={key}>
                        {resourceLabel(key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </VStack>

            <VStack gap={2} align='stretch'>
              <Label htmlFor='add-on-quantity'>Quantity</Label>
              <Input
                id='add-on-quantity'
                type='number'
                min={1}
                step={1}
                value={quantity}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  setQuantity(Number.isNaN(next) ? 0 : next);
                }}
                data-testid='add-on-quantity'
              />
            </VStack>

            <VStack gap={2} align='stretch'>
              <Label>Billing</Label>
              <RadioGroup
                value={isRecurring ? 'recurring' : 'one-time'}
                onValueChange={(value) => setIsRecurring(value === 'recurring')}
              >
                <HStack gap={2} align='center'>
                  <RadioGroupItem
                    value='one-time'
                    id='add-on-one-time'
                    data-testid='add-on-one-time'
                  />
                  <Label htmlFor='add-on-one-time' className='font-normal'>
                    One-time pack
                  </Label>
                </HStack>
                <HStack gap={2} align='center'>
                  <RadioGroupItem
                    value='recurring'
                    id='add-on-recurring'
                    data-testid='add-on-recurring'
                  />
                  <Label htmlFor='add-on-recurring' className='font-normal'>
                    Recurring (renews each period)
                  </Label>
                </HStack>
              </RadioGroup>
            </VStack>

            {errorMessage !== null && (
              <Alert variant='destructive' data-testid='purchase-add-on-error'>
                <Icon icon={TriangleAlert} />
                <AlertTitle>We couldn&apos;t complete your purchase</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {showPaymentField && (
              <PaymentInstrumentField
                ref={paymentFieldRef}
                createSdk={createSdk}
              />
            )}

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type='button'
                onClick={handleSubmit}
                disabled={isPending || !canSubmit}
                data-testid='purchase-add-on-submit'
              >
                {isPending ? 'Submitting…' : 'Buy capacity'}
              </Button>
            </DialogFooter>
          </VStack>
        )}
      </DialogContent>
    </Dialog>
  );
}
