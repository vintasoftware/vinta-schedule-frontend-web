/**
 * useRetryPayment tests.
 *
 * Covers:
 * - the ergonomic `retryPayment(body)` calls the generated retry-payment
 *   factory with the exact `RetryPaymentRequest` body (idempotency_key,
 *   payment_token);
 * - on success the subscription read is invalidated (the 200 body is still
 *   grace/restricted — recovery is webhook-driven — so the caller polls
 *   separately, but the cached read must reflect the fresh response).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { billingSubscriptionRetrieveSubscriptionRetrieveOptions } from '@/client/@tanstack/react-query.gen';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    billingSubscriptionRetryPaymentCreate: vi.fn(),
  };
});

import { billingSubscriptionRetryPaymentCreate } from '@/client/sdk.gen';
import { useRetryPayment } from './use-retry-payment';

type Result = Awaited<ReturnType<typeof billingSubscriptionRetryPaymentCreate>>;

function makeOk(): Result {
  // The 200 body is still grace/restricted — recovery is webhook-driven.
  const body = { id: 1, billing_state: 'grace', pending_plan_slug: '' };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Result;
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(
    billingSubscriptionRetrieveSubscriptionRetrieveOptions().queryKey,
    { billing_state: 'grace' } as never
  );
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }
  return { Wrapper, queryClient };
}

describe('useRetryPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the retry-payment factory with the RetryPaymentRequest body', async () => {
    vi.mocked(billingSubscriptionRetryPaymentCreate).mockResolvedValue(
      makeOk()
    );

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRetryPayment(), {
      wrapper: Wrapper,
    });

    await result.current.retryPayment({
      idempotency_key: 'key-1',
      payment_token: 'tok_abc',
    });

    expect(billingSubscriptionRetryPaymentCreate).toHaveBeenCalledTimes(1);
    expect(billingSubscriptionRetryPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          idempotency_key: 'key-1',
          payment_token: 'tok_abc',
        },
      })
    );
  });

  it('invalidates the subscription read on success', async () => {
    vi.mocked(billingSubscriptionRetryPaymentCreate).mockResolvedValue(
      makeOk()
    );

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useRetryPayment(), {
      wrapper: Wrapper,
    });

    await result.current.retryPayment({
      idempotency_key: 'key-2',
      payment_token: 'tok_def',
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryState(
          billingSubscriptionRetrieveSubscriptionRetrieveOptions().queryKey
        )?.isInvalidated
      ).toBe(true);
    });
  });
});
