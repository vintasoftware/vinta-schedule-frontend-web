/**
 * useCreateBillingProfile tests.
 *
 * Covers:
 * - the ergonomic `createBillingProfile(body)` calls the generated
 *   create-billing-profile factory with the exact `BillingProfileWritable` body;
 * - on success the billing-profile read is invalidated so the form refetches the
 *   now-existing profile.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import type { BillingProfileWritable } from '@/client';
import { billingProfileRetrieveBillingProfileRetrieveOptions } from '@/client/@tanstack/react-query.gen';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    billingProfileCreateBillingProfileCreate: vi.fn(),
  };
});

import { billingProfileCreateBillingProfileCreate } from '@/client/sdk.gen';
import { useCreateBillingProfile } from './use-create-billing-profile';

type Result = Awaited<
  ReturnType<typeof billingProfileCreateBillingProfileCreate>
>;

const BODY: BillingProfileWritable = {
  contact_first_name: 'Ada',
  contact_last_name: 'Lovelace',
  contact_email: 'ada@example.com',
  contact_phone: '+1 555 000 0000',
  document_type: 'OTHER',
  document_number: '123456789',
  billing_address: {
    street_name: 'Main',
    street_number: '42',
    city: 'London',
    state: 'LDN',
    country: 'GB',
    zip_code: 'EC1A',
  },
};

function makeOk(): Result {
  const body = { id: 1, ...BODY };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 201 }),
  } as unknown as Result;
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // Seed the profile read so we can assert it gets invalidated on success.
  queryClient.setQueryData(
    billingProfileRetrieveBillingProfileRetrieveOptions().queryKey,
    null as never
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

describe('useCreateBillingProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the create factory with the BillingProfileWritable body', async () => {
    vi.mocked(billingProfileCreateBillingProfileCreate).mockResolvedValue(
      makeOk()
    );

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateBillingProfile(), {
      wrapper: Wrapper,
    });

    await result.current.createBillingProfile(BODY);

    expect(billingProfileCreateBillingProfileCreate).toHaveBeenCalledTimes(1);
    expect(billingProfileCreateBillingProfileCreate).toHaveBeenCalledWith(
      expect.objectContaining({ body: BODY })
    );
  });

  it('invalidates the billing-profile read on success', async () => {
    vi.mocked(billingProfileCreateBillingProfileCreate).mockResolvedValue(
      makeOk()
    );

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useCreateBillingProfile(), {
      wrapper: Wrapper,
    });

    await result.current.createBillingProfile(BODY);

    await waitFor(() => {
      expect(
        queryClient.getQueryState(
          billingProfileRetrieveBillingProfileRetrieveOptions().queryKey
        )?.isInvalidated
      ).toBe(true);
    });
  });
});
