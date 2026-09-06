/**
 * useCreateBookingCode tests.
 *
 * Covers:
 * - Create calls bookingCodesCreate with the given body.
 * - The resolved value carries the one-time plaintext `code`.
 * - A failed mint rejects (no silent success).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    bookingCodesCreate: vi.fn(),
  };
});

import { bookingCodesCreate } from '@/client/sdk.gen';
import type { BookingCodeCreateResult } from '@/client';
import { useCreateBookingCode } from './use-create-booking-code';

function makeResult(
  overrides: Partial<BookingCodeCreateResult> = {}
): BookingCodeCreateResult {
  return {
    id: 1,
    code: 'plaintext-code-once-only',
    purpose: 'book',
    calendar: 5,
    appointment_type: null,
    event: null,
    expires_at: null,
    ...overrides,
  };
}

function makeCreateResponse(
  result: BookingCodeCreateResult
): Awaited<ReturnType<typeof bookingCodesCreate>> {
  return {
    data: result,
    response: new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof bookingCodesCreate>>;
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
  return { Wrapper, queryClient };
}

describe('useCreateBookingCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls bookingCodesCreate with the given body', async () => {
    vi.mocked(bookingCodesCreate).mockResolvedValueOnce(
      makeCreateResponse(makeResult())
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateBookingCode(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.createBookingCode({
        purpose: 'book',
        calendar: 5,
      });
    });

    expect(vi.mocked(bookingCodesCreate)).toHaveBeenCalledOnce();
    expect(vi.mocked(bookingCodesCreate)).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { purpose: 'book', calendar: 5 },
      })
    );
  });

  it('resolves with the one-time plaintext code', async () => {
    const codeResult = makeResult({ id: 7, code: 'once-only-secret' });
    vi.mocked(bookingCodesCreate).mockResolvedValueOnce(
      makeCreateResponse(codeResult)
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateBookingCode(), {
      wrapper: Wrapper,
    });

    let resolved: BookingCodeCreateResult | undefined;
    await act(async () => {
      resolved = await result.current.createBookingCode({
        purpose: 'book',
        calendar: 5,
      });
    });

    expect(resolved).toEqual(codeResult);
  });

  it('rejects when the mint endpoint fails', async () => {
    vi.mocked(bookingCodesCreate).mockRejectedValueOnce(
      new Error('Not permitted')
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateBookingCode(), {
      wrapper: Wrapper,
    });

    await expect(
      act(async () => {
        await result.current.createBookingCode({
          purpose: 'book',
          calendar: 5,
        });
      })
    ).rejects.toThrow('Not permitted');
  });
});
