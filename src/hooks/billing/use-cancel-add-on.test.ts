/**
 * useCancelAddOn tests.
 *
 * Covers:
 * - the ergonomic `cancelAddOn(id)` calls the generated add-on-destroy factory
 *   with the id stringified into the DELETE path;
 * - on success BOTH the subscription and usage reads are invalidated (the
 *   add-on stops renewing and the effective limits shift at period end), so the
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
    billingAddOnsDestroy: vi.fn(),
  };
});

import { billingAddOnsDestroy } from '@/client/sdk.gen';
import { useCancelAddOn } from './use-cancel-add-on';

type Result = Awaited<ReturnType<typeof billingAddOnsDestroy>>;

function makeOk(): Result {
  const body = {
    id: 7,
    resource_key: 'event_occurrences',
    quantity: 100,
    is_recurring: true,
    is_active: true,
    external_id: 'ext_7',
    created: '2026-08-09T00:00:00Z',
  };
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

describe('useCancelAddOn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the add-on-destroy factory with the id in the DELETE path', async () => {
    vi.mocked(billingAddOnsDestroy).mockResolvedValue(makeOk());

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCancelAddOn(), { wrapper: Wrapper });

    await result.current.cancelAddOn(7);

    expect(billingAddOnsDestroy).toHaveBeenCalledTimes(1);
    expect(billingAddOnsDestroy).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: '7' } })
    );
  });

  it('invalidates both the subscription and usage reads on success', async () => {
    vi.mocked(billingAddOnsDestroy).mockResolvedValue(makeOk());

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useCancelAddOn(), { wrapper: Wrapper });

    await result.current.cancelAddOn(7);

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
