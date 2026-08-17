'use client';

/**
 * ChangePlanDialog — the upgrade/downgrade flow (Phase 3; API objective 2).
 *
 * This is a MONEY-PATH surface. Three invariants carry the whole feature and are
 * the things to scrutinize:
 *
 * 1. ONE idempotency key per user attempt, reused across every retry.
 *    A per-attempt `createIdempotencyKeyHolder` lives in a ref, scoped to this
 *    component instance. The picker mounts a fresh ChangePlanDialog per plan
 *    selection, so a genuinely new attempt is a new mount with a new holder.
 *    Within one mount the lazy `.key` mints once and holds stable, so a
 *    400-then-retry (or a double-click) sends the SAME key — the API is
 *    idempotent per key, so this is what stops a double-charge.
 *
 * 2. Payment token only the FIRST time the billing root attaches an instrument.
 *    We show `PaymentInstrumentField` up-front when the org has no paid
 *    instrument yet (`billing_state` free/cancelled / no subscription) and send
 *    the minted token. As a backstop, a `400 PaymentTokenRequiredError` reveals
 *    the field and lets the user retry — reusing the same idempotency key. A
 *    returning (already-paying) org never sees the card field and submits
 *    without a token.
 *
 * 3. Success is asynchronous — the UI polls, it never assumes.
 *    change-plan returns a subscription with `pending_*` set BEFORE the provider
 *    webhook confirms. On a successful initiate we enter `useAwaitPaymentConfirmation`
 *    (poll the subscription every ~3s for up to ~60s) and show a PENDING state —
 *    never "done" off the initiate response — falling back to a calm "still
 *    confirming" with a manual re-check at the ceiling.
 *
 * 4. A scheduled change is never confirmed — it must NEVER enter the poll.
 *    An immediate/charged change is confirmed by a webhook that clears
 *    `pending_plan_slug` within the poll window; a scheduled (deferred,
 *    no-charge) change sets `pending_plan_effective_at` (end of the current
 *    period) instead and `pending_plan_slug` will NOT clear during that
 *    window. Polling it would therefore always exhaust the ceiling and
 *    wrongly land on "taking longer than usual". Which of the two the
 *    backend did is read straight off the initiate RESPONSE: a non-null
 *    `pending_plan_effective_at` means scheduled/no-charge — routed straight
 *    to a terminal "scheduled for {date}" state instead of
 *    `confirmation.start()`. A null `pending_plan_effective_at` means
 *    immediate/charged — always polled. This is authoritative (the backend's
 *    own decision) and interval-agnostic; a client-side price comparison
 *    cannot reproduce it, because the backend compares the current plan at
 *    the subscription's OWN interval against the target at the requested
 *    interval, not both plans at the same (possibly just-toggled) interval.
 *
 * Errors branch on the parsed body (throwOnError:true): `400` token-required →
 * reveal/keep the card field; `402` over-limit (downgrade below usage) →
 * `readOverLimitError`; `409` (a change already awaiting confirmation / provider
 * unconfigured) → `readBillingConflict`.
 */

import * as React from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  TriangleAlert,
} from 'lucide-react';

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
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { Box, HStack, Text, VStack } from 'vinta-schedule-design-system/layout';

import type {
  BillingPlan,
  PendingBillingIntervalEnum,
  Subscription,
} from '@/client';
import { useChangePlan } from '@/hooks/billing/use-change-plan';
import { useSubscription } from '@/hooks/billing/use-subscription';
import { useAwaitPaymentConfirmation } from '@/hooks/billing/use-await-payment-confirmation';
import { createIdempotencyKeyHolder } from '@/lib/billing/idempotency';
import { formatMoney, formatPeriod } from '@/lib/billing/format';
import type { PaymentProviderSdkFactory } from '@/lib/billing/payment-provider-sdk';
import type { PaymentInstrumentResult } from '@/lib/billing/payment-token';
import {
  isPaymentTokenRequiredError,
  readBillingConflict,
  readOverLimitError,
} from '@/lib/utils/api-errors';

import {
  PaymentInstrumentField,
  type PaymentInstrumentFieldHandle,
} from './payment-instrument-field';

type Phase =
  | 'form'
  | 'confirming'
  | 'confirmed'
  | 'still_processing'
  | 'scheduled';

export interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The plan the user is switching TO. */
  plan: BillingPlan;
  /** The interval driving price + `billing_interval` (from the picker toggle). */
  billingInterval: PendingBillingIntervalEnum;
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
 * The confirmation predicate: a pending change is settled ONLY once a real
 * subscription object comes back with `pending_plan_slug` cleared. A
 * null/undefined/missing read must NEVER resolve as confirmed — on a first-time
 * upgrade the new subscription is not readable for a beat (the free org's
 * `GET /billing/subscription/` 404s and the post-initiate refetch can resolve
 * before the row exists), and treating that absence as success would render
 * "done" BEFORE the webhook confirms the charge. So an absent read keeps polling.
 */
function isPendingChangeConfirmed(
  subscription: Subscription | null | undefined
): boolean {
  if (subscription === null || subscription === undefined) {
    return false;
  }
  return !subscription.pending_plan_slug;
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

export function ChangePlanDialog({
  open,
  onOpenChange,
  plan,
  billingInterval,
  subscription,
  createSdk,
}: ChangePlanDialogProps) {
  const { changePlan, changePlanMutation } = useChangePlan();
  // Same query key as the parent's subscription read (shared cache); we use its
  // refetch as the confirmation poll.
  const { subscriptionQuery } = useSubscription();

  const confirmation = useAwaitPaymentConfirmation<
    Subscription | null | undefined
  >({
    poll: async () => {
      // Do NOT coalesce a missing/absent read into a resolvable sentinel: a
      // not-yet-readable subscription must keep polling, never settle. The
      // predicate below rejects null/undefined for the same reason.
      const { data } = await subscriptionQuery.refetch();
      return data;
    },
    isResolved: isPendingChangeConfirmed,
  });

  // One key per attempt, reused across every retry within this attempt. The key
  // is scoped to this component instance: the picker mounts a fresh
  // ChangePlanDialog per plan selection (it renders it only while a target plan
  // is chosen), so a genuinely new attempt is a new mount with a new holder —
  // there is no cross-attempt reset to get wrong. Within one mount the lazy
  // `.key` mints once and holds stable across the 400-then-retry path.
  const idempotencyHolderRef = React.useRef(createIdempotencyKeyHolder());

  const paymentFieldRef = React.useRef<PaymentInstrumentFieldHandle>(null);

  const [phase, setPhase] = React.useState<Phase>('form');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [showPaymentField, setShowPaymentField] = React.useState(
    () => !hasPaidInstrument(subscription)
  );
  // Only set for the downgrade path — read off the initiate response's
  // `pending_plan_effective_at`, never off a webhook (downgrades have none).
  const [scheduledEffectiveAt, setScheduledEffectiveAt] = React.useState<
    string | null
  >(null);

  const price =
    billingInterval === 'annual' ? plan.annual_price : plan.monthly_price;
  const priceLabel = price === null ? '—' : formatMoney(price, plan.currency);

  const isPending = changePlanMutation.isPending;

  const handleSubmit = async () => {
    setErrorMessage(null);

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

    let updated: Subscription;
    try {
      updated = await changePlan({
        plan_slug: plan.slug,
        billing_interval: billingInterval,
        idempotency_key: idempotencyKey,
        payment_token: paymentToken,
      });
    } catch (err) {
      if (isPaymentTokenRequiredError(err)) {
        // First-time instrument attach. Reveal the card field and let the user
        // retry — the idempotency holder is NOT reset, so the retry reuses the
        // same key.
        setShowPaymentField(true);
        setErrorMessage('Please add a payment method to continue.');
        return;
      }
      const overLimit = readOverLimitError(err);
      if (overLimit) {
        setErrorMessage(overLimit.detail);
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

    if (updated.pending_plan_effective_at !== null) {
      // A change with a non-null `pending_plan_effective_at` is scheduled and
      // shown, never polled: it's deferred (no charge yet), so
      // `pending_plan_slug` will not clear during the poll window (it clears
      // at `pending_plan_effective_at`, later). Entering `confirmation.start()`
      // here would always exhaust the ceiling and wrongly land on "taking
      // longer than usual" — so we terminate on the initiate response instead.
      setScheduledEffectiveAt(updated.pending_plan_effective_at);
      setPhase('scheduled');
      return;
    }

    // Never "done" off the initiate response: poll until the webhook confirms.
    setPhase('confirming');
    const result = await confirmation.start();
    setPhase(result.status === 'confirmed' ? 'confirmed' : 'still_processing');
  };

  const handleCheckAgain = async () => {
    setPhase('confirming');
    const result = await confirmation.start();
    setPhase(result.status === 'confirmed' ? 'confirmed' : 'still_processing');
  };

  const isCurrentPlan = subscription?.plan.slug === plan.slug;
  const actionLabel = isCurrentPlan ? 'Confirm change' : 'Switch plan';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Change to {plan.name}</DialogTitle>
          <DialogDescription>
            Review the plan and interval before confirming.
          </DialogDescription>
        </DialogHeader>

        {phase === 'confirming' && (
          <VStack
            gap={3}
            py={4}
            align='center'
            data-testid='change-plan-confirming'
          >
            <Icon icon={Loader2} spin color='muted-foreground' />
            <Text weight='medium'>Confirming your payment…</Text>
            <Text size='sm' color='muted-foreground' align='center'>
              We&apos;re waiting for your payment provider to confirm the
              change. This usually takes a few seconds.
            </Text>
          </VStack>
        )}

        {phase === 'confirmed' && (
          <VStack
            gap={3}
            py={4}
            align='center'
            data-testid='change-plan-confirmed'
          >
            <Icon icon={CheckCircle2} color='success' />
            <Text weight='medium'>You&apos;re on the {plan.name} plan</Text>
            <Text size='sm' color='muted-foreground' align='center'>
              Your new limits are now in effect.
            </Text>
            <DialogFooter>
              <Button type='button' onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </VStack>
        )}

        {phase === 'scheduled' && (
          <VStack
            gap={3}
            py={4}
            align='center'
            data-testid='change-plan-scheduled'
          >
            <Icon icon={CalendarClock} color='muted-foreground' />
            <Text weight='medium'>Your plan change is scheduled</Text>
            <Text size='sm' color='muted-foreground' align='center'>
              Your plan will change to {plan.name} on{' '}
              {scheduledEffectiveAt !== null
                ? formatPeriod(scheduledEffectiveAt)
                : 'your next billing date'}
              .
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
            data-testid='change-plan-still-processing'
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
            <Box
              p={3}
              radius='md'
              border
              bg='muted'
              data-testid='change-plan-summary'
            >
              <HStack gap={2} align='center' justify='between'>
                <VStack gap={1} align='start'>
                  <Text weight='semibold'>{plan.name}</Text>
                  <Badge variant='info'>
                    {billingInterval === 'annual' ? 'Annual' : 'Monthly'}
                  </Badge>
                </VStack>
                <Text weight='semibold' data-testid='change-plan-price'>
                  {priceLabel}
                </Text>
              </HStack>
            </Box>

            {errorMessage !== null && (
              <Alert variant='destructive' data-testid='change-plan-error'>
                <Icon icon={TriangleAlert} />
                <AlertTitle>We couldn&apos;t change your plan</AlertTitle>
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
                disabled={isPending}
                data-testid='change-plan-submit'
              >
                {isPending ? 'Submitting…' : actionLabel}
              </Button>
            </DialogFooter>
          </VStack>
        )}
      </DialogContent>
    </Dialog>
  );
}
