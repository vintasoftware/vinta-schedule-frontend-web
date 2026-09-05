/**
 * useRevokeBookingCode tests.
 *
 * Covers:
 * - Revoke calls bookingCodesDestroy with the id, stringified for the path
 *   param.
 * - Revoke reports success uniformly — it never claims to have discovered
 *   whether the code existed (the endpoint is a non-oracle 204).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    bookingCodesDestroy: vi.fn(),
  };
});

import { bookingCodesDestroy } from '@/client/sdk.gen';
import { useRevokeBookingCode } from './use-revoke-booking-code';

function makeDestroyResponse(): Awaited<
  ReturnType<typeof bookingCodesDestroy>
> {
  return {
    data: undefined,
    response: new Response(null, { status: 204 }),
  } as unknown as Awaited<ReturnType<typeof bookingCodesDestroy>>;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper };
}

describe('useRevokeBookingCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls bookingCodesDestroy with the stringified id', async () => {
    vi.mocked(bookingCodesDestroy).mockResolvedValueOnce(makeDestroyResponse());

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRevokeBookingCode(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.revokeBookingCode(42);
    });

    expect(vi.mocked(bookingCodesDestroy)).toHaveBeenCalledOnce();
    expect(vi.mocked(bookingCodesDestroy)).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: '42' } })
    );
  });

  it('resolves without throwing on the uniform 204, regardless of whether the id ever existed', async () => {
    vi.mocked(bookingCodesDestroy).mockResolvedValueOnce(makeDestroyResponse());

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRevokeBookingCode(), {
      wrapper: Wrapper,
    });

    await expect(
      act(async () => {
        await result.current.revokeBookingCode(999999);
      })
    ).resolves.not.toThrow();
  });
});
