/**
 * useOccurrenceLedger tests.
 *
 * Covers:
 * - spreads the generated billingUsageOccurrencesList factory and exposes
 *   results as `occurrences` + `totalCount`
 * - passes the ledger filter query params through to the generated factory
 * - a 403 (non-billing member) surfaces as isError with an empty list
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    billingUsageOccurrencesList: vi.fn(),
  };
});

import { billingUsageOccurrencesList } from '@/client/sdk.gen';
import { useOccurrenceLedger } from './use-occurrence-ledger';

type Result = Awaited<ReturnType<typeof billingUsageOccurrencesList>>;

function makeListResponse(results: Array<{ organization: number }>): Result {
  const body = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Result;
}

function make403(): Result {
  return {
    data: undefined,
    response: new Response(null, { status: 403 }),
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

describe('useOccurrenceLedger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the ledger rows and total count', async () => {
    vi.mocked(billingUsageOccurrencesList).mockResolvedValue(
      makeListResponse([{ organization: 1 }, { organization: 1 }])
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useOccurrenceLedger(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.occurrences).toHaveLength(2);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.isError).toBe(false);
  });

  it('passes the ledger filter query params to the generated factory', async () => {
    vi.mocked(billingUsageOccurrencesList).mockResolvedValue(
      makeListResponse([])
    );

    const filters = {
      billing_period_start: '2026-08-01T00:00:00Z',
      is_within_allowance: false,
      organization: 3,
      occurrence_start_after: '2026-08-01T00:00:00Z',
      occurrence_start_before: '2026-08-31T00:00:00Z',
      limit: 100,
      offset: 0,
    };

    const { Wrapper } = makeQueryWrapper();
    renderHook(() => useOccurrenceLedger({ filters }), { wrapper: Wrapper });

    await waitFor(() =>
      expect(billingUsageOccurrencesList).toHaveBeenCalledWith(
        expect.objectContaining({ query: filters })
      )
    );
  });

  it('surfaces a 403 (non-billing member) as isError with an empty list', async () => {
    vi.mocked(billingUsageOccurrencesList).mockResolvedValue(make403());

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useOccurrenceLedger(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.occurrences).toEqual([]);
  });
});
