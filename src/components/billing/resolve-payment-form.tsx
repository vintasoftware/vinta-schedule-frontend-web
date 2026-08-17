'use client';

/**
 * ResolvePaymentForm — the GRACE / RESTRICTED payment-recovery surface
 * (billing-hardening Phase 7; the recovery direction of Use-case 5).
 *
 * This is a MONEY-PATH surface. The hardened API now exposes a dedicated
 * recovery endpoint, `POST /billing/subscription/retry-payment/`
 * (`RetryPaymentRequest = { idempotency_key, payment_token }`), consumed via
 * `useRetryPayment`. It attaches a FRESH payment instrument and resubmits the
 * outstanding balance for collection — there is no plan to re-affirm (the
 * endpoint doesn't take `plan_slug`/`billing_interval`; the org's plan is
 * unchanged, only the instrument + charge are retried).
 *
 * Four invariants carry the flow:
 *
 * 1. ONE idempotency key per attempt, reused across every retry OF THAT SAME
 *    ATTEMPT (double-click, network retry, a "check again" re-poll). A
 *    per-attempt `createIdempotencyKeyHolder` lives in a ref scoped to this
 *    mount; the lazy `.key` mints once and holds stable, so a retry sends the
 *    SAME key — the API is idempotent per key, so this is what stops a
 *    double-charge on the recovery re-initiate.
 *
 * 2. A NEW key is minted ONLY when the previous attempt's charge was
 *    genuinely declined (`charge_declined`, told apart from the over-limit
 *    `limit_exceeded` 402 by `code`). A declined charge means the user is
 *    about to try a DIFFERENT card — reusing the stale key would replay the
 *    cached declined result against the provider and the new card would never
 *    be charged, so `.reset()` runs exactly there. Every other error (the four
 *    409 conflicts, a network/generic failure) leaves the key untouched: those
 *    did not attempt-and-decline a charge, and minting a fresh key blind risks
 *    a double charge if one is actually in flight.
 *
 * 3. A FRESH instrument every time. Recovery is re-attaching an instrument, so
 *    `PaymentInstrumentField` is always shown and its minted token is always
 *    sent — there is no "returning org already has one" shortcut here.
 *
 * 4. Success is asynchronous — the UI polls, it never assumes. The 200
 *    response is NOT success: recovery is webhook-driven, so the returned
 *    subscription is still `grace`/`restricted`; it only moves to `active`
 *    once the subscription-payment webhook confirms the charge. On a
 *    successful initiate we enter `useAwaitPaymentConfirmation` and poll the
 *    subscription until its `billing_state` returns to `active` — never
 *    "done" off the initiate response — falling back to a calm "still
 *    confirming" state with a manual re-check at the ceiling. The confirm
 *    predicate resolves ONLY for a real subscription object that is back to
 *    `active`; a null/undefined/missing read keeps polling (a not-yet-readable
 *    refetch must never be mistaken for recovery).
 *
 * Coded 409s each get a distinct message; `subscription_not_attached` (the org
 * never attached an instrument at the provider — it has never paid) is not a
 * retry case at all, so it routes to the first-payment/upgrade flow
 * (`/billing/plans`) instead of re-prompting for a card here.
 */

import * as React from 'react';
import { CheckCircle2, Clock, Loader2, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from 'vinta-schedule-design-system/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import {
  Box,
  Center,
  HStack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';

import type { Subscription } from '@/client';
import { useRetryPayment } from '@/hooks/billing/use-retry-payment';
import { useSubscription } from '@/hooks/billing/use-subscription';
import { useAwaitPaymentConfirmation } from '@/hooks/billing/use-await-payment-confirmation';
import { createIdempotencyKeyHolder } from '@/lib/billing/idempotency';
import { formatMoney, formatPeriod } from '@/lib/billing/format';
import type { PaymentProviderSdkFactory } from '@/lib/billing/payment-provider-sdk';
import type { PaymentInstrumentResult } from '@/lib/billing/payment-token';
import {
  isChargeDeclinedError,
  isCollectionNotSupportedError,
  isNoOutstandingBalanceError,
  isRetryPaymentNotApplicableError,
  isSubscriptionNotAttachedError,
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
  | 'needs_upgrade';

export interface ResolvePaymentFormProps {
  /**
   * The org's current subscription — always in GRACE / RESTRICTED here (the
   * route guards this). Supplies the plan being kept and the grace deadline
   * shown on the form; nothing is re-affirmed (the endpoint doesn't take
   * `plan_slug`/`billing_interval`).
   */
  subscription: Subscription;
  /**
   * Injectable SDK factory forwarded to `PaymentInstrumentField` (stories/tests
   * pass a fake so no real provider script loads). Production leaves it default.
   */
  createSdk?: PaymentProviderSdkFactory;
}

/**
 * The recovery confirm predicate: dunning recovery is settled ONLY once a real
 * subscription object comes back with `billing_state === 'active'`. A
 * null/undefined/missing read must NEVER resolve as confirmed — a refetch can
 * transiently yield no data (a cache miss, a slow round-trip), and treating that
 * absence as success would render "recovered" BEFORE the webhook flips the org
 * back to ACTIVE. A still-GRACE / still-RESTRICTED read likewise keeps polling.
 * So only an explicit `active` state confirms; everything else waits.
 */
export function isRecoveryConfirmed(
  subscription: Subscription | null | undefined
): boolean {
  if (subscription === null || subscription === undefined) {
    return false;
  }
  return subscription.billing_state === 'active';
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

export function ResolvePaymentForm({
  subscription,
  createSdk,
}: ResolvePaymentFormProps) {
  const { retryPayment, retryPaymentMutation } = useRetryPayment();
  // Same query key as the parent's subscription read (shared cache); we use its
  // refetch as the confirmation poll back to ACTIVE.
  const { subscriptionQuery } = useSubscription();

  const confirmation = useAwaitPaymentConfirmation<
    Subscription | null | undefined
  >({
    poll: async () => {
      // Do NOT coalesce a missing/absent read into a resolvable sentinel: a
      // not-yet-readable subscription must keep polling, never settle. The
      // predicate rejects null/undefined for the same reason.
      const { data } = await subscriptionQuery.refetch();
      return data;
    },
    isResolved: isRecoveryConfirmed,
  });

  // One key per attempt, reused across every retry of that SAME attempt. The
  // lazy `.key` mints once and holds stable across a retried submit, so a
  // double-click / network retry re-sends the SAME key (no double-charge). A
  // fresh key is minted ONLY when `charge_declined` fires below — the user is
  // about to try a different card, so the stale key must not be replayed
  // against the new one (see the module docstring, invariant 2).
  const idempotencyHolderRef = React.useRef(createIdempotencyKeyHolder());
  const paymentFieldRef = React.useRef<PaymentInstrumentFieldHandle>(null);

  const [phase, setPhase] = React.useState<Phase>('form');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const plan = subscription.plan;
  const interval = subscription.billing_interval;
  const price = interval === 'annual' ? plan.annual_price : plan.monthly_price;
  const priceLabel = price === null ? '—' : formatMoney(price, plan.currency);
  const gracePeriodEndsAt = subscription.grace_period_ends_at;

  const isPending = retryPaymentMutation.isPending;

  const handleSubmit = async () => {
    setErrorMessage(null);

    // Recovery always re-attaches a fresh instrument — tokenize up-front.
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
    const paymentToken = result.token;

    // Read the key ONCE per submit; the holder returns the same value on a
    // retry, so a retried submit reuses it (no double-charge) unless the
    // previous attempt's charge was declined (handled below).
    const idempotencyKey = idempotencyHolderRef.current.key;

    try {
      await retryPayment({
        idempotency_key: idempotencyKey,
        payment_token: paymentToken,
      });
    } catch (err) {
      if (isChargeDeclinedError(err)) {
        // The card was declined — the user will now try a DIFFERENT card.
        // Reset the key so the NEXT submit mints a fresh one: the backend is
        // idempotent per key, so reusing this attempt's key would return the
        // cached declined result and the new card would never be charged
        // (the double-charge guard this whole flow exists for). Refetch the
        // subscription so its state is current, then stay on the form.
        idempotencyHolderRef.current.reset();
        await subscriptionQuery.refetch();
        setErrorMessage('That card was declined — try a different card.');
        return;
      }
      if (isRetryPaymentNotApplicableError(err)) {
        setErrorMessage(
          "Your subscription doesn't need a payment retry right now."
        );
        return;
      }
      if (isNoOutstandingBalanceError(err)) {
        setErrorMessage("There's no outstanding balance to pay right now.");
        return;
      }
      if (isCollectionNotSupportedError(err)) {
        setErrorMessage(
          "Automatic payment retry isn't available for your payment provider."
        );
        return;
      }
      if (isSubscriptionNotAttachedError(err)) {
        // This org has never attached an instrument — it has never paid, so
        // it belongs on the first-payment/upgrade flow, not a retry.
        setPhase('needs_upgrade');
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

    // Never "done" off the initiate response: poll until the org is ACTIVE.
    setPhase('confirming');
    const outcome = await confirmation.start();
    setPhase(outcome.status === 'confirmed' ? 'confirmed' : 'still_processing');
  };

  const handleCheckAgain = async () => {
    setPhase('confirming');
    const outcome = await confirmation.start();
    setPhase(outcome.status === 'confirmed' ? 'confirmed' : 'still_processing');
  };

  if (phase === 'needs_upgrade') {
    return (
      <Card data-testid='resolve-payment-needs-upgrade'>
        <CardContent>
          <VStack gap={3} py={4} align='center'>
            <Icon icon={TriangleAlert} color='muted-foreground' />
            <Text weight='medium'>This organization has never paid yet</Text>
            <Text size='sm' color='muted-foreground' align='center'>
              There&apos;s no payment method on file to retry. Choose a plan and
              add a payment method to get started.
            </Text>
            <Button asChild>
              <Link href='/billing/plans'>Choose a plan</Link>
            </Button>
          </VStack>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'confirming') {
    return (
      <Card data-testid='resolve-payment-confirming'>
        <CardContent>
          <VStack gap={3} py={4} align='center'>
            <Icon icon={Loader2} spin color='muted-foreground' />
            <Text weight='medium'>Confirming your payment…</Text>
            <Text size='sm' color='muted-foreground' align='center'>
              We&apos;re waiting for your payment provider to confirm the
              charge. This usually takes a few seconds.
            </Text>
          </VStack>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'confirmed') {
    return (
      <Card data-testid='resolve-payment-confirmed'>
        <CardContent>
          <VStack gap={3} py={4} align='center'>
            <Icon icon={CheckCircle2} color='success' />
            <Text weight='medium'>Your payment is confirmed</Text>
            <Text size='sm' color='muted-foreground' align='center'>
              Your {plan.name} plan is active again and full access is restored.
            </Text>
            <Button asChild>
              <Link href='/billing'>Back to billing</Link>
            </Button>
          </VStack>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'still_processing') {
    return (
      <Card data-testid='resolve-payment-still-processing'>
        <CardContent>
          <VStack gap={3} py={4} align='center'>
            <Icon icon={Clock} color='muted-foreground' />
            <Text weight='medium'>Still confirming your payment</Text>
            <Text size='sm' color='muted-foreground' align='center'>
              This is taking longer than usual. Your payment provider is still
              processing — you can check again in a moment, or come back later.
            </Text>
            <HStack gap={2}>
              <Button asChild variant='outline'>
                <Link href='/billing'>Back to billing</Link>
              </Button>
              <Button
                type='button'
                onClick={handleCheckAgain}
                data-testid='resolve-payment-check-again'
              >
                Check again
              </Button>
            </HStack>
          </VStack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid='resolve-payment-form'>
      <CardHeader>
        <CardTitle>Update your payment method</CardTitle>
        <CardDescription>
          A recent payment for your plan didn&apos;t go through. Add a payment
          method below to retry the charge and restore full access — you keep
          your current plan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VStack gap={4} align='stretch'>
          <Box
            p={3}
            radius='md'
            border
            bg='muted'
            data-testid='resolve-payment-plan'
          >
            <HStack gap={2} align='center' justify='between'>
              <VStack gap={1} align='start'>
                <Text size='sm' color='muted-foreground'>
                  Keeping your current plan
                </Text>
                <HStack gap={2} align='center'>
                  <Text weight='semibold'>{plan.name}</Text>
                  <Badge variant='info'>
                    {interval === 'annual' ? 'Annual' : 'Monthly'}
                  </Badge>
                </HStack>
              </VStack>
              <Text weight='semibold' data-testid='resolve-payment-price'>
                {priceLabel}
              </Text>
            </HStack>
          </Box>

          {gracePeriodEndsAt ? (
            <Text
              size='sm'
              color='muted-foreground'
              data-testid='resolve-payment-deadline'
            >
              Resolve payment before {formatPeriod(gracePeriodEndsAt)} to keep
              full access.
            </Text>
          ) : null}

          {errorMessage !== null && (
            <Alert variant='destructive' data-testid='resolve-payment-error'>
              <Icon icon={TriangleAlert} />
              <AlertTitle>We couldn&apos;t process your payment</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <PaymentInstrumentField ref={paymentFieldRef} createSdk={createSdk} />

          <Center>
            <Button
              type='button'
              onClick={handleSubmit}
              disabled={isPending}
              fullWidth
              data-testid='resolve-payment-submit'
            >
              {isPending ? 'Submitting…' : 'Retry payment'}
            </Button>
          </Center>
        </VStack>
      </CardContent>
    </Card>
  );
}
