/**
 * usePurchaseAddOn tests.
 *
 * Covers:
 * - the ergonomic `purchaseAddOn(body)` calls the generated add-on-create
 *   factory with the exact `AddOnPurchaseRequest` body (resource_key, quantity,
 *   is_recurring, idempotency_key, payment_token);
 * - on success BOTH the subscription and usage reads are invalidated (the
 *   `201` returns before the webhook grants capacity and moves the limits), so
 *   the overview refetches.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import {
  billingSubscriptionRetrieveSubscriptionRetrieveOptions,
  billingUsageRetrieveUsageRetrieveOptions,
} from '@/client/@tanstack/react-query.gen';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    billingAddOnsCreate: vi.fn(),
  };
});

import { billingAddOnsCreate } from '@/client/sdk.gen';
import { usePurchaseAddOn } from './use-purchase-add-on';

type Result = Awaited<ReturnType<typeof billingAddOnsCreate>>;

function makeOk(): Result {
  const body = {
    id: 7,
    resource_key: 'event_occurrences',
    quantity: 100,
    is_recurring: true,
    is_active: false,
    external_id: '',
    created: '2026-08-09T00:00:00Z',
  };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 201 }),
  } as unknown as Result;
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // Seed the two reads so we can assert they get invalidated on success.
  queryClient.setQueryData(
    billingSubscriptionRetrieveSubscriptionRetrieveOptions().queryKey,
    { billing_state: 'free' } as never
  );
  queryClient.setQueryData(
    billingUsageRetrieveUsageRetrieveOptions().queryKey,
    { billing_state: 'free' } as never
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

describe('usePurchaseAddOn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the add-on-create factory with the AddOnPurchaseRequest body', async () => {
    vi.mocked(billingAddOnsCreate).mockResolvedValue(makeOk());

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => usePurchaseAddOn(), {
      wrapper: Wrapper,
    });

    await result.current.purchaseAddOn({
      resource_key: 'event_occurrences',
      quantity: 100,
      is_recurring: true,
      idempotency_key: 'key-1',
      payment_token: 'tok_abc',
    });

    expect(billingAddOnsCreate).toHaveBeenCalledTimes(1);
    expect(billingAddOnsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          resource_key: 'event_occurrences',
          quantity: 100,
          is_recurring: true,
          idempotency_key: 'key-1',
          payment_token: 'tok_abc',
        },
      })
    );
  });

  it('invalidates both the subscription and usage reads on success', async () => {
    vi.mocked(billingAddOnsCreate).mockResolvedValue(makeOk());

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => usePurchaseAddOn(), {
      wrapper: Wrapper,
    });

    await result.current.purchaseAddOn({
      resource_key: 'event_occurrences',
      quantity: 50,
      idempotency_key: 'key-2',
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryState(
          billingSubscriptionRetrieveSubscriptionRetrieveOptions().queryKey
        )?.isInvalidated
      ).toBe(true);
      expect(
        queryClient.getQueryState(
          billingUsageRetrieveUsageRetrieveOptions().queryKey
        )?.isInvalidated
      ).toBe(true);
    });
  });
});
