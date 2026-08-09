/**
 * useBillingPeriod tests.
 *
 * Covers:
 * - spreads the generated billingUsagePeriodsRetrieve factory with the path id
 *   and exposes its payload as `period`
 * - gates the fetch with enabled: id != null (no id → no fetch)
 * - a 404 (out-of-pool id) surfaces as isError with period:null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    billingUsagePeriodsRetrieve: vi.fn(),
  };
});

import { billingUsagePeriodsRetrieve } from '@/client/sdk.gen';
import { useBillingPeriod } from './use-billing-period';

type Result = Awaited<ReturnType<typeof billingUsagePeriodsRetrieve>>;

function makeOk(body: { id: number }): Result {
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

describe('useBillingPeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches by path id and exposes the payload', async () => {
    vi.mocked(billingUsagePeriodsRetrieve).mockResolvedValue(
      makeOk({ id: 42 })
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useBillingPeriod('42'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(billingUsagePeriodsRetrieve).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: '42' } })
    );
    expect(result.current.period).toEqual({ id: 42 });
  });

  it('does not fetch when id is null', () => {
    vi.mocked(billingUsagePeriodsRetrieve).mockResolvedValue(makeOk({ id: 1 }));

    const { Wrapper } = makeQueryWrapper();
    renderHook(() => useBillingPeriod(null), { wrapper: Wrapper });

    expect(billingUsagePeriodsRetrieve).not.toHaveBeenCalled();
  });

  it('surfaces a 404 (out-of-pool id) as isError with period:null', async () => {
    vi.mocked(billingUsagePeriodsRetrieve).mockResolvedValue(make404());

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useBillingPeriod('999'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.period).toBeNull();
  });
});
