/**
 * useUpdateBillingProfile tests.
 *
 * Covers:
 * - the ergonomic `updateBillingProfile(body)` calls the generated
 *   partial-update factory (PATCH) with the exact
 *   `PatchedBillingProfileWritable` body;
 * - on success the billing-profile read is invalidated so the form refetches.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import type { PatchedBillingProfileWritable } from '@/client';
import { billingProfileRetrieveBillingProfileRetrieveOptions } from '@/client/@tanstack/react-query.gen';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    billingProfilePartialUpdateBillingProfilePartialUpdate: vi.fn(),
  };
});

import { billingProfilePartialUpdateBillingProfilePartialUpdate } from '@/client/sdk.gen';
import { useUpdateBillingProfile } from './use-update-billing-profile';

type Result = Awaited<
  ReturnType<typeof billingProfilePartialUpdateBillingProfilePartialUpdate>
>;

const BODY: PatchedBillingProfileWritable = {
  contact_first_name: 'Grace',
  contact_email: 'grace@example.com',
  document_type: 'tax_id',
  document_number: '987654321',
  billing_address: {
    street_name: 'Second',
    street_number: '7',
    city: 'Baltimore',
    state: 'MD',
    country: 'US',
    zip_code: '21201',
  },
};

function makeOk(): Result {
  const body = { id: 1, ...BODY };
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
    billingProfileRetrieveBillingProfileRetrieveOptions().queryKey,
    { id: 1 } as never
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

describe('useUpdateBillingProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the partial-update factory with the PatchedBillingProfileWritable body', async () => {
    vi.mocked(
      billingProfilePartialUpdateBillingProfilePartialUpdate
    ).mockResolvedValue(makeOk());

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateBillingProfile(), {
      wrapper: Wrapper,
    });

    await result.current.updateBillingProfile(BODY);

    expect(
      billingProfilePartialUpdateBillingProfilePartialUpdate
    ).toHaveBeenCalledTimes(1);
    expect(
      billingProfilePartialUpdateBillingProfilePartialUpdate
    ).toHaveBeenCalledWith(expect.objectContaining({ body: BODY }));
  });

  it('invalidates the billing-profile read on success', async () => {
    vi.mocked(
      billingProfilePartialUpdateBillingProfilePartialUpdate
    ).mockResolvedValue(makeOk());

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useUpdateBillingProfile(), {
      wrapper: Wrapper,
    });

    await result.current.updateBillingProfile(BODY);

    await waitFor(() => {
      expect(
        queryClient.getQueryState(
          billingProfileRetrieveBillingProfileRetrieveOptions().queryKey
        )?.isInvalidated
      ).toBe(true);
    });
  });
});
