/**
 * PaymentInstrumentField tests.
 *
 * The whole point of the phase is that this one component sits in front of two
 * external SDKs without ever touching the network in a test: the SDK is
 * acquired through an injected `createSdk` factory, so every case below passes
 * a FAKE `PaymentProviderSdk`.
 *
 * Covers:
 * - a Stripe provider loads its (fake) SDK and `tokenize()` returns its token;
 * - a MercadoPago provider likewise;
 * - a 409/unconfigured provider renders the unavailable state, never mounts a
 *   card element, never builds an SDK, and `tokenize()` returns `unconfigured`;
 * - an incomplete card yields `{ status: 'error', reason: 'incomplete' }`;
 * - an SDK load failure yields `{ status: 'error', reason: 'sdk_load_failed' }`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';

import type { PaymentProvider } from '@/client';
import { asPaymentToken } from '@/lib/billing/payment-token';
import type {
  PaymentInstrumentResult,
  PaymentProviderSdk,
} from '@/lib/billing/payment-token';
import type { PaymentProviderSdkFactory } from '@/lib/billing/payment-provider-sdk';

const mockUsePaymentProvider = vi.fn();
vi.mock('@/hooks/billing/use-payment-provider', () => ({
  usePaymentProvider: () => mockUsePaymentProvider(),
}));

import {
  PaymentInstrumentField,
  type PaymentInstrumentFieldHandle,
} from './payment-instrument-field';

const STRIPE_PROVIDER: PaymentProvider = {
  provider: 'stripe',
  stripe: { publishable_key: 'pk_test_123' },
  mercadopago: null,
};

const MERCADOPAGO_PROVIDER: PaymentProvider = {
  provider: 'mercadopago',
  stripe: null,
  mercadopago: { public_key: 'MP_PUB_123' },
};

interface FakeSdkBehavior {
  loadRejects?: boolean;
  tokenizeResult?: PaymentInstrumentResult;
}

/**
 * Builds a spy-able fake SDK factory. Returns the factory plus the spies so a
 * test can assert whether the SDK was ever built / mounted (the "never mounts"
 * case) and what `tokenize()` was asked to return.
 */
function makeFakeFactory(behavior: FakeSdkBehavior = {}) {
  const load = vi.fn(async () => {
    if (behavior.loadRejects) throw new Error('sdk boom');
  });
  const mountCardElement = vi.fn(async () => {});
  const tokenize = vi.fn(
    async (): Promise<PaymentInstrumentResult> =>
      behavior.tokenizeResult ?? {
        status: 'tokenized',
        token: asPaymentToken('tok_default'),
      }
  );
  const sdk: PaymentProviderSdk = { load, mountCardElement, tokenize };
  const factory = vi.fn(() => sdk) as unknown as PaymentProviderSdkFactory & {
    load: typeof load;
    mountCardElement: typeof mountCardElement;
    tokenize: typeof tokenize;
  };
  return { factory, load, mountCardElement, tokenize };
}

function mockProvider(
  value: PaymentProvider | null,
  extra: { isLoading?: boolean; isError?: boolean } = {}
) {
  mockUsePaymentProvider.mockReturnValue({
    paymentProvider: value,
    isLoading: extra.isLoading ?? false,
    isError: extra.isError ?? false,
    error: null,
    paymentProviderQuery: {},
  });
}

describe('PaymentInstrumentField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the Stripe SDK and returns its token from tokenize()', async () => {
    mockProvider(STRIPE_PROVIDER);
    const { factory, mountCardElement } = makeFakeFactory({
      tokenizeResult: {
        status: 'tokenized',
        token: asPaymentToken('tok_stripe'),
      },
    });
    const ref = createRef<PaymentInstrumentFieldHandle>();

    render(<PaymentInstrumentField ref={ref} createSdk={factory} />);

    await waitFor(() => expect(mountCardElement).toHaveBeenCalledTimes(1));
    expect(factory).toHaveBeenCalledWith(STRIPE_PROVIDER);

    const result = await ref.current!.tokenize();
    expect(result).toEqual({
      status: 'tokenized',
      token: 'tok_stripe',
    });
  });

  it('loads the MercadoPago SDK and returns its token from tokenize()', async () => {
    mockProvider(MERCADOPAGO_PROVIDER);
    const { factory, mountCardElement } = makeFakeFactory({
      tokenizeResult: {
        status: 'tokenized',
        token: asPaymentToken('tok_mp'),
      },
    });
    const ref = createRef<PaymentInstrumentFieldHandle>();

    render(<PaymentInstrumentField ref={ref} createSdk={factory} />);

    await waitFor(() => expect(mountCardElement).toHaveBeenCalledTimes(1));
    expect(factory).toHaveBeenCalledWith(MERCADOPAGO_PROVIDER);

    const result = await ref.current!.tokenize();
    expect(result).toEqual({ status: 'tokenized', token: 'tok_mp' });
  });

  it('renders the unavailable state and never mounts a card element when the provider is unconfigured (409)', async () => {
    // 409 surfaces from usePaymentProvider as isError with a null provider.
    mockProvider(null, { isError: true });
    const { factory, mountCardElement } = makeFakeFactory();
    const ref = createRef<PaymentInstrumentFieldHandle>();

    render(<PaymentInstrumentField ref={ref} createSdk={factory} />);

    expect(screen.getByTestId('payment-field-unavailable')).toBeInTheDocument();
    expect(
      screen.queryByTestId('payment-card-element')
    ).not.toBeInTheDocument();
    // The SDK is never even constructed, let alone mounted.
    expect(factory).not.toHaveBeenCalled();
    expect(mountCardElement).not.toHaveBeenCalled();

    const result = await ref.current!.tokenize();
    expect(result).toEqual({
      status: 'error',
      reason: 'unconfigured',
      message: expect.any(String),
    });
  });

  it('does not mount a card element when the resolved provider is missing its credential', () => {
    mockProvider({ provider: 'stripe', stripe: null, mercadopago: null });
    const { factory } = makeFakeFactory();

    render(<PaymentInstrumentField createSdk={factory} />);

    expect(screen.getByTestId('payment-field-unavailable')).toBeInTheDocument();
    expect(factory).not.toHaveBeenCalled();
  });

  it('returns { reason: incomplete } when the card is incomplete', async () => {
    mockProvider(STRIPE_PROVIDER);
    const { factory, mountCardElement } = makeFakeFactory({
      tokenizeResult: {
        status: 'error',
        reason: 'incomplete',
        message: 'Your card number is incomplete.',
      },
    });
    const ref = createRef<PaymentInstrumentFieldHandle>();

    render(<PaymentInstrumentField ref={ref} createSdk={factory} />);
    await waitFor(() => expect(mountCardElement).toHaveBeenCalledTimes(1));

    const result = await ref.current!.tokenize();
    expect(result).toEqual({
      status: 'error',
      reason: 'incomplete',
      message: 'Your card number is incomplete.',
    });
  });

  it('returns { reason: sdk_load_failed } when the SDK fails to load', async () => {
    mockProvider(STRIPE_PROVIDER);
    const { factory, load, mountCardElement } = makeFakeFactory({
      loadRejects: true,
    });
    const ref = createRef<PaymentInstrumentFieldHandle>();

    render(<PaymentInstrumentField ref={ref} createSdk={factory} />);

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    // A failed load never reaches the mount step.
    expect(mountCardElement).not.toHaveBeenCalled();
    // The mounting placeholder clears once the load settles into load_failed.
    await waitFor(() =>
      expect(
        screen.queryByTestId('payment-card-mounting')
      ).not.toBeInTheDocument()
    );

    const result = await ref.current!.tokenize();
    expect(result).toEqual({
      status: 'error',
      reason: 'sdk_load_failed',
      message: expect.any(String),
    });
  });

  it('renders a distinct load-failed error state and tokenize() still returns sdk_load_failed', async () => {
    mockProvider(STRIPE_PROVIDER);
    const { factory, load } = makeFakeFactory({ loadRejects: true });
    const ref = createRef<PaymentInstrumentFieldHandle>();

    render(<PaymentInstrumentField ref={ref} createSdk={factory} />);

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    // A visible error state — distinct from the unavailable state — appears.
    await waitFor(() =>
      expect(
        screen.getByTestId('payment-field-load-failed')
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByTestId('payment-field-unavailable')
    ).not.toBeInTheDocument();
    // The bare card container is not left showing behind the error.
    expect(
      screen.queryByTestId('payment-card-element')
    ).not.toBeInTheDocument();

    const result = await ref.current!.tokenize();
    expect(result).toEqual({
      status: 'error',
      reason: 'sdk_load_failed',
      message: expect.any(String),
    });
  });

  it('shows a skeleton while the provider is still loading', () => {
    mockProvider(null, { isLoading: true });
    const { factory } = makeFakeFactory();

    render(<PaymentInstrumentField createSdk={factory} />);

    expect(screen.getByTestId('payment-field-loading')).toBeInTheDocument();
    expect(factory).not.toHaveBeenCalled();
  });
});
