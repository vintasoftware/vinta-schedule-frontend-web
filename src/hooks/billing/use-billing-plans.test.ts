/**
 * useBillingPlans tests.
 *
 * Covers:
 * - spreads the generated billingPlansList factory and exposes results as
 *   `plans` + `totalCount`
 * - passes filter query params through to the generated factory
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
    billingPlansList: vi.fn(),
  };
});

import { billingPlansList } from '@/client/sdk.gen';
import { useBillingPlans } from './use-billing-plans';

type Result = Awaited<ReturnType<typeof billingPlansList>>;

function makeListResponse(results: Array<{ slug: string }>): Result {
  const body = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
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

describe('useBillingPlans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the plan results and total count', async () => {
    vi.mocked(billingPlansList).mockResolvedValue(
      makeListResponse([{ slug: 'pro' }, { slug: 'team' }])
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useBillingPlans(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.plans).toHaveLength(2);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.isError).toBe(false);
  });

  it('passes filter query params to the generated factory', async () => {
    vi.mocked(billingPlansList).mockResolvedValue(makeListResponse([]));

    const { Wrapper } = makeQueryWrapper();
    renderHook(() => useBillingPlans({ query: { is_active: true } }), {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(billingPlansList).toHaveBeenCalledWith(
        expect.objectContaining({ query: { is_active: true } })
      )
    );
  });

  it('does not fetch when enabled:false', () => {
    vi.mocked(billingPlansList).mockResolvedValue(makeListResponse([]));

    const { Wrapper } = makeQueryWrapper();
    renderHook(() => useBillingPlans({ enabled: false }), { wrapper: Wrapper });

    expect(billingPlansList).not.toHaveBeenCalled();
  });
});
