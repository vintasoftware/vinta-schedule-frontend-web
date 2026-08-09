/**
 * useSubscription tests.
 *
 * Covers:
 * - spreads the generated billingSubscriptionRetrieveSubscriptionRetrieve
 *   factory and exposes its payload as `subscription`
 * - a 404 (no subscription) surfaces as isError with subscription:null
 * - enabled:false skips the fetch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    billingSubscriptionRetrieveSubscriptionRetrieve: vi.fn(),
  };
});

import { billingSubscriptionRetrieveSubscriptionRetrieve } from '@/client/sdk.gen';
import { useSubscription } from './use-subscription';

type Result = Awaited<
  ReturnType<typeof billingSubscriptionRetrieveSubscriptionRetrieve>
>;

function makeOk(body: { billing_state: string }): Result {
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Result;
}

function make404(): Result {
  return {
    data: undefined,
    response: new Response(JSON.stringify({ detail: 'Not found.' }), {
      status: 404,
    }),
  } as unknown as Result;
}

function makeQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }
  return { Wrapper };
}

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the subscription payload from the generated factory', async () => {
    vi.mocked(
      billingSubscriptionRetrieveSubscriptionRetrieve
    ).mockResolvedValue(makeOk({ billing_state: 'active' }));

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useSubscription(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(
      billingSubscriptionRetrieveSubscriptionRetrieve
    ).toHaveBeenCalledTimes(1);
    expect(result.current.subscription).toEqual({ billing_state: 'active' });
    expect(result.current.isError).toBe(false);
  });

  it('surfaces a 404 (no subscription) as isError with subscription:null', async () => {
    vi.mocked(
      billingSubscriptionRetrieveSubscriptionRetrieve
    ).mockResolvedValue(make404());

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useSubscription(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.subscription).toBeNull();
  });

  it('does not fetch when enabled:false', () => {
    vi.mocked(
      billingSubscriptionRetrieveSubscriptionRetrieve
    ).mockResolvedValue(makeOk({ billing_state: 'active' }));

    const { Wrapper } = makeQueryWrapper();
    renderHook(() => useSubscription({ enabled: false }), { wrapper: Wrapper });

    expect(
      billingSubscriptionRetrieveSubscriptionRetrieve
    ).not.toHaveBeenCalled();
  });
});
