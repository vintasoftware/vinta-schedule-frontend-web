'use client';

/**
 * PaymentInstrumentField — the ONE, provider-agnostic card field every purchase
 * flow (Phases 3/4/5) embeds to mint a `payment_token` (Phase 1).
 *
 * It resolves the deployment's provider from `usePaymentProvider`
 * (`GET /billing/payment-provider/`), lazy-loads THAT provider's JS SDK, mounts
 * its secure card element (a provider iframe) into a design-system-styled
 * container, and exposes an imperative `tokenize()` on a ref. Every resolved
 * provider outcome sits behind this single contract, so parent flows never
 * branch on provider — they hold a ref and call `tokenize()`.
 *
 * DESIGN-FOR-TEST: the SDK is acquired through an INJECTED `createSdk` factory
 * (default: the real script-injecting `createProviderSdk`). Tests and stories
 * pass a fake `PaymentProviderSdk`, so no real Stripe script is loaded and no
 * network is touched. See `payment-provider-sdk.ts`.
 *
 * When the provider is unconfigured (the endpoint's `409`, surfaced as
 * `isError`) or its credentials are missing, the field renders a calm
 * "payments unavailable" state and NEVER mounts a card element — and its
 * `tokenize()` returns `{ status: 'error', reason: 'unconfigured' }` so the
 * parent flow degrades safely instead of charging.
 *
 * When the provider resolves to anything other than Stripe (MercadoPago is a
 * documented non-goal — see `payment-provider-sdk.ts`), the field renders a
 * distinct "not available" state and likewise NEVER mounts a card element —
 * `tokenize()` returns `{ status: 'error', reason: 'unsupported_provider' }`.
 */

import * as React from 'react';
import { CreditCard, TriangleAlert } from 'lucide-react';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { Skeleton } from 'vinta-schedule-design-system/ui/skeleton';
import { Box, Text, VStack } from 'vinta-schedule-design-system/layout';

import type { PaymentProvider } from '@/client';
import { usePaymentProvider } from '@/hooks/billing/use-payment-provider';
import {
  createProviderSdk,
  type PaymentProviderSdkFactory,
} from '@/lib/billing/payment-provider-sdk';
import type {
  PaymentInstrumentResult,
  PaymentProviderSdk,
} from '@/lib/billing/payment-token';

/** The imperative surface a parent flow drives at submit time. */
export interface PaymentInstrumentFieldHandle {
  tokenize(): Promise<PaymentInstrumentResult>;
}

export interface PaymentInstrumentFieldProps {
  /** Optional label above the card element. */
  label?: string;
  /**
   * Injectable SDK factory — defaults to the real script-injecting factory.
   * Tests/stories pass a fake to avoid loading a provider script.
   */
  createSdk?: PaymentProviderSdkFactory;
}

type SdkState = 'idle' | 'loading' | 'ready' | 'load_failed';

/**
 * Returns whether a resolved Stripe provider carries the publishable key its
 * SDK needs. A `stripe` provider without its key is treated as unavailable —
 * we never mount a card field we can't tokenize. (Only Stripe has a working
 * adapter; any other provider is handled as `unsupported_provider` before this
 * is ever consulted — see `isUnsupportedProvider` below.)
 */
function hasCredential(provider: PaymentProvider): boolean {
  return provider.provider === 'stripe' && provider.stripe !== null;
}

export const PaymentInstrumentField = React.forwardRef<
  PaymentInstrumentFieldHandle,
  PaymentInstrumentFieldProps
>(function PaymentInstrumentField(
  { label = 'Card details', createSdk = createProviderSdk },
  ref
) {
  const { paymentProvider, isLoading, isError } = usePaymentProvider();

  const providerResolved = !isError && paymentProvider !== null;
  // Stripe is the only provider with a working adapter (MercadoPago is a
  // documented non-goal — see `payment-provider-sdk.ts`). Any other resolved
  // provider renders the "not available" state below and never mounts a card
  // field.
  const isUnsupportedProvider =
    providerResolved && paymentProvider.provider !== 'stripe';
  const available =
    providerResolved &&
    paymentProvider.provider === 'stripe' &&
    hasCredential(paymentProvider);

  const containerRef = React.useRef<HTMLElement | null>(null);
  const sdkRef = React.useRef<PaymentProviderSdk | null>(null);
  const [sdkState, setSdkState] = React.useState<SdkState>('idle');
  // Bumped by the load-failed "Try again" action to re-run the load effect. The
  // state flips back to 'loading' first so the card container re-renders and the
  // effect finds a live mount target.
  const [reloadNonce, setReloadNonce] = React.useState(0);

  React.useEffect(() => {
    if (
      !available ||
      paymentProvider === null ||
      containerRef.current === null
    ) {
      return;
    }

    let cancelled = false;
    const sdk = createSdk(paymentProvider);
    sdkRef.current = sdk;
    setSdkState('loading');

    void (async () => {
      try {
        await sdk.load();
        if (cancelled || containerRef.current === null) return;
        await sdk.mountCardElement(containerRef.current);
        if (cancelled) return;
        setSdkState('ready');
      } catch {
        if (!cancelled) setSdkState('load_failed');
      }
    })();

    return () => {
      cancelled = true;
      sdk.unmount?.();
      if (sdkRef.current === sdk) sdkRef.current = null;
    };
  }, [available, paymentProvider, createSdk, reloadNonce]);

  const handleRetry = React.useCallback(() => {
    setSdkState('loading');
    setReloadNonce((nonce) => nonce + 1);
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      async tokenize(): Promise<PaymentInstrumentResult> {
        if (!providerResolved) {
          return {
            status: 'error',
            reason: 'unconfigured',
            message: 'Payments are unavailable right now.',
          };
        }
        if (isUnsupportedProvider) {
          return {
            status: 'error',
            reason: 'unsupported_provider',
            message: "Card payment isn't available for this payment provider.",
          };
        }
        if (!available) {
          return {
            status: 'error',
            reason: 'unconfigured',
            message: 'Payments are unavailable right now.',
          };
        }
        if (sdkState === 'load_failed' || sdkRef.current === null) {
          return {
            status: 'error',
            reason: 'sdk_load_failed',
            message: 'The payment field failed to load. Please try again.',
          };
        }
        return sdkRef.current.tokenize();
      },
    }),
    [providerResolved, isUnsupportedProvider, available, sdkState]
  );

  if (isLoading) {
    return (
      <Skeleton className='h-24 w-full' data-testid='payment-field-loading' />
    );
  }

  if (isUnsupportedProvider) {
    return (
      <Alert variant='warning' data-testid='payment-field-unsupported'>
        <Icon icon={TriangleAlert} />
        <AlertTitle>Card payment isn&apos;t available</AlertTitle>
        <AlertDescription>
          Card payment isn&apos;t available for this deployment&apos;s payment
          provider. Contact support.
        </AlertDescription>
      </Alert>
    );
  }

  if (!available) {
    return (
      <Alert variant='warning' data-testid='payment-field-unavailable'>
        <Icon icon={TriangleAlert} />
        <AlertTitle>Payments are unavailable</AlertTitle>
        <AlertDescription>
          This organization can&apos;t take card payments right now. Please try
          again later or contact support.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <VStack gap={2} data-testid='payment-instrument-field'>
      <Text as='label' size='sm' weight='medium' color='foreground'>
        {label}
      </Text>
      {sdkState === 'load_failed' ? (
        <Alert variant='destructive' data-testid='payment-field-load-failed'>
          <Icon icon={TriangleAlert} />
          <AlertTitle>We couldn&apos;t load the payment field</AlertTitle>
          <AlertDescription>
            <VStack gap={2} align='start'>
              <Text size='sm'>
                Something went wrong loading our payment provider. Please try
                again.
              </Text>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={handleRetry}
              >
                Try again
              </Button>
            </VStack>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Box
            ref={containerRef}
            p={3}
            radius='md'
            bg='background'
            border
            className='min-h-11'
            data-testid='payment-card-element'
          >
            {sdkState === 'loading' ? (
              <Skeleton
                className='h-5 w-full'
                data-testid='payment-card-mounting'
              />
            ) : null}
          </Box>
          <Text size='xs' color='muted-foreground'>
            <Icon icon={CreditCard} size='xs' /> Your card is handled directly
            by our payment provider.
          </Text>
        </>
      )}
    </VStack>
  );
});
