/**
 * useBillingUsage tests.
 *
 * Covers:
 * - spreads the generated billingUsageRetrieveUsageRetrieve factory and
 *   exposes its payload as `usage`
 * - a failed fetch surfaces as isError with usage:null
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
    billingUsageRetrieveUsageRetrieve: vi.fn(),
  };
});

import { billingUsageRetrieveUsageRetrieve } from '@/client/sdk.gen';
import { useBillingUsage } from './use-billing-usage';
import type { UsageResponse } from '@/client';

const FIXTURE_USAGE: UsageResponse = {
  billing_state: 'free',
  billing_root_organization_id: 1,
  plan: null,
  billing_period: null,
  estimated_overage_total: '0.0000',
  limits: [],
};

type Result = Awaited<ReturnType<typeof billingUsageRetrieveUsageRetrieve>>;

function makeOk(body: UsageResponse): Result {
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

describe('useBillingUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the usage payload from the generated factory', async () => {
    vi.mocked(billingUsageRetrieveUsageRetrieve).mockResolvedValue(
      makeOk(FIXTURE_USAGE)
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useBillingUsage(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(billingUsageRetrieveUsageRetrieve).toHaveBeenCalledTimes(1);
    expect(result.current.usage).toEqual(FIXTURE_USAGE);
    expect(result.current.isError).toBe(false);
  });

  it('surfaces a failed fetch as isError with usage:null', async () => {
    vi.mocked(billingUsageRetrieveUsageRetrieve).mockResolvedValue(makeError());

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useBillingUsage(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.usage).toBeNull();
  });

  it('does not fetch when enabled:false', () => {
    vi.mocked(billingUsageRetrieveUsageRetrieve).mockResolvedValue(
      makeOk(FIXTURE_USAGE)
    );

    const { Wrapper } = makeQueryWrapper();
    renderHook(() => useBillingUsage({ enabled: false }), { wrapper: Wrapper });

    expect(billingUsageRetrieveUsageRetrieve).not.toHaveBeenCalled();
  });
});
