/**
 * useChangePlan tests.
 *
 * Covers:
 * - the ergonomic `changePlan(body)` calls the generated change-plan factory
 *   with the exact `ChangePlanRequest` body (plan_slug, billing_interval,
 *   idempotency_key, payment_token);
 * - on success BOTH the subscription and usage reads are invalidated (the
 *   pending plan lands via webhook and the effective limits move), so the
 *   overview refetches.
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
    billingSubscriptionChangePlanCreate: vi.fn(),
  };
});

import { billingSubscriptionChangePlanCreate } from '@/client/sdk.gen';
import { useChangePlan } from './use-change-plan';

type Result = Awaited<ReturnType<typeof billingSubscriptionChangePlanCreate>>;

function makeOk(): Result {
  const body = { id: 1, billing_state: 'active', pending_plan_slug: 'team' };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
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

describe('useChangePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the change-plan factory with the ChangePlanRequest body', async () => {
    vi.mocked(billingSubscriptionChangePlanCreate).mockResolvedValue(makeOk());

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useChangePlan(), { wrapper: Wrapper });

    await result.current.changePlan({
      plan_slug: 'team',
      billing_interval: 'annual',
      idempotency_key: 'key-1',
      payment_token: 'tok_abc',
    });

    expect(billingSubscriptionChangePlanCreate).toHaveBeenCalledTimes(1);
    expect(billingSubscriptionChangePlanCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          plan_slug: 'team',
          billing_interval: 'annual',
          idempotency_key: 'key-1',
          payment_token: 'tok_abc',
        },
      })
    );
  });

  it('invalidates both the subscription and usage reads on success', async () => {
    vi.mocked(billingSubscriptionChangePlanCreate).mockResolvedValue(makeOk());

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useChangePlan(), { wrapper: Wrapper });

    await result.current.changePlan({
      plan_slug: 'team',
      billing_interval: 'monthly',
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
