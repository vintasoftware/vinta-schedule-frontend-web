/**
 * useCancelSubscription tests.
 *
 * Covers:
 * - `cancelSubscription()` calls the generated cancel factory (no body);
 * - on success BOTH the subscription and usage reads are invalidated.
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
    billingSubscriptionCancelCreate: vi.fn(),
  };
});

import { billingSubscriptionCancelCreate } from '@/client/sdk.gen';
import { useCancelSubscription } from './use-cancel-subscription';

type Result = Awaited<ReturnType<typeof billingSubscriptionCancelCreate>>;

function makeOk(): Result {
  const body = { id: 1, billing_state: 'cancelled' };
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
    { billing_state: 'active' } as never
  );
  queryClient.setQueryData(
    billingUsageRetrieveUsageRetrieveOptions().queryKey,
    { billing_state: 'active' } as never
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

describe('useCancelSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the cancel factory', async () => {
    vi.mocked(billingSubscriptionCancelCreate).mockResolvedValue(makeOk());

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCancelSubscription(), {
      wrapper: Wrapper,
    });

    await result.current.cancelSubscription();

    expect(billingSubscriptionCancelCreate).toHaveBeenCalledTimes(1);
  });

  it('invalidates both the subscription and usage reads on success', async () => {
    vi.mocked(billingSubscriptionCancelCreate).mockResolvedValue(makeOk());

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useCancelSubscription(), {
      wrapper: Wrapper,
    });

    await result.current.cancelSubscription();

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
