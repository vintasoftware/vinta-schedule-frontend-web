/**
 * useBillingProfile tests.
 *
 * Covers:
 * - spreads the generated billingProfileRetrieveBillingProfileRetrieve factory
 *   and exposes its payload as `billingProfile`
 * - a failed fetch surfaces as isError with billingProfile:null
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
    billingProfileRetrieveBillingProfileRetrieve: vi.fn(),
  };
});

import { billingProfileRetrieveBillingProfileRetrieve } from '@/client/sdk.gen';
import { useBillingProfile } from './use-billing-profile';

type Result = Awaited<
  ReturnType<typeof billingProfileRetrieveBillingProfileRetrieve>
>;

function makeOk(body: { id: number }): Result {
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Result;
}

function makeError(): Result {
  return {
    data: undefined,
    response: new Response(null, { status: 500 }),
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

describe('useBillingProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the billing-profile payload from the generated factory', async () => {
    vi.mocked(billingProfileRetrieveBillingProfileRetrieve).mockResolvedValue(
      makeOk({ id: 7 })
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useBillingProfile(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(billingProfileRetrieveBillingProfileRetrieve).toHaveBeenCalledTimes(
      1
    );
    expect(result.current.billingProfile).toEqual({ id: 7 });
    expect(result.current.isError).toBe(false);
  });

  it('surfaces a failed fetch as isError with billingProfile:null', async () => {
    vi.mocked(billingProfileRetrieveBillingProfileRetrieve).mockResolvedValue(
      makeError()
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useBillingProfile(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.billingProfile).toBeNull();
  });

  it('does not fetch when enabled:false', () => {
    vi.mocked(billingProfileRetrieveBillingProfileRetrieve).mockResolvedValue(
      makeOk({ id: 7 })
    );

    const { Wrapper } = makeQueryWrapper();
    renderHook(() => useBillingProfile({ enabled: false }), {
      wrapper: Wrapper,
    });

    expect(billingProfileRetrieveBillingProfileRetrieve).not.toHaveBeenCalled();
  });
});
