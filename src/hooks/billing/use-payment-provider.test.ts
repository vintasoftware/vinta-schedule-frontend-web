/**
 * usePaymentProvider tests.
 *
 * Covers:
 * - spreads the generated billingPaymentProviderRetrieve factory and exposes
 *   its payload as `paymentProvider`
 * - a 409 (provider unconfigured) surfaces as isError with
 *   paymentProvider:null
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
    billingPaymentProviderRetrieve: vi.fn(),
  };
});

import { billingPaymentProviderRetrieve } from '@/client/sdk.gen';
import { usePaymentProvider } from './use-payment-provider';

type Result = Awaited<ReturnType<typeof billingPaymentProviderRetrieve>>;

function makeOk(body: { provider: string }): Result {
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Result;
}

function make409(): Result {
  return {
    data: undefined,
    response: new Response(null, { status: 409 }),
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

describe('usePaymentProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the payment-provider payload from the generated factory', async () => {
    vi.mocked(billingPaymentProviderRetrieve).mockResolvedValue(
      makeOk({ provider: 'stripe' })
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => usePaymentProvider(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(billingPaymentProviderRetrieve).toHaveBeenCalledTimes(1);
    expect(result.current.paymentProvider).toEqual({ provider: 'stripe' });
    expect(result.current.isError).toBe(false);
  });

  it('surfaces a 409 (unconfigured) as isError with paymentProvider:null', async () => {
    vi.mocked(billingPaymentProviderRetrieve).mockResolvedValue(make409());

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => usePaymentProvider(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.paymentProvider).toBeNull();
  });

  it('does not fetch when enabled:false', () => {
    vi.mocked(billingPaymentProviderRetrieve).mockResolvedValue(
      makeOk({ provider: 'stripe' })
    );

    const { Wrapper } = makeQueryWrapper();
    renderHook(() => usePaymentProvider({ enabled: false }), {
      wrapper: Wrapper,
    });

    expect(billingPaymentProviderRetrieve).not.toHaveBeenCalled();
  });
});
