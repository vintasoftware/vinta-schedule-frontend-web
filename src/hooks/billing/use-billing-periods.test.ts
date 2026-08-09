/**
 * useBillingPeriods tests.
 *
 * Covers:
 * - spreads the generated billingUsagePeriodsList factory and exposes results
 *   as `periods` + `totalCount`
 * - passes date/charged filter query params through to the generated factory
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
    billingUsagePeriodsList: vi.fn(),
  };
});

import { billingUsagePeriodsList } from '@/client/sdk.gen';
import { useBillingPeriods } from './use-billing-periods';

type Result = Awaited<ReturnType<typeof billingUsagePeriodsList>>;

function makeListResponse(results: Array<{ id: number }>): Result {
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

describe('useBillingPeriods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the period results and total count', async () => {
    vi.mocked(billingUsagePeriodsList).mockResolvedValue(
      makeListResponse([{ id: 1 }, { id: 2 }])
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useBillingPeriods(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.periods).toHaveLength(2);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.isError).toBe(false);
  });

  it('passes date/charged filter query params to the generated factory', async () => {
    vi.mocked(billingUsagePeriodsList).mockResolvedValue(makeListResponse([]));

    const filters = {
      billing_period_start_after: '2026-01-01T00:00:00Z',
      billing_period_start_before: '2026-12-31T00:00:00Z',
      charged: true,
    };

    const { Wrapper } = makeQueryWrapper();
    renderHook(() => useBillingPeriods({ filters }), { wrapper: Wrapper });

    await waitFor(() =>
      expect(billingUsagePeriodsList).toHaveBeenCalledWith(
        expect.objectContaining({ query: filters })
      )
    );
  });

  it('does not fetch when enabled:false', () => {
    vi.mocked(billingUsagePeriodsList).mockResolvedValue(makeListResponse([]));

    const { Wrapper } = makeQueryWrapper();
    renderHook(() => useBillingPeriods({ enabled: false }), {
      wrapper: Wrapper,
    });

    expect(billingUsagePeriodsList).not.toHaveBeenCalled();
  });
});
