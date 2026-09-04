/**
 * usePublicCancel tests.
 *
 * Covers:
 * - A successful cancel (`204`, no body) resolves without trying to parse a
 *   response body, and sends the code as `X-Booking-Code`.
 * - Write failures map to `PublicWriteFailureError`; `ALREADY_USED` is
 *   terminal and worded distinctly from other failures via its `error_code`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    publicBookingEventsCancelCreate: vi.fn(),
  };
});

import { publicBookingEventsCancelCreate } from '@/client/sdk.gen';
import { PublicWriteFailureError } from '@/lib/booking-links/errors';
import { usePublicCancel } from './use-public-cancel';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

describe('usePublicCancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves on a 204 with no body, and sends the code as X-Booking-Code', async () => {
    vi.mocked(publicBookingEventsCancelCreate).mockResolvedValueOnce({
      data: undefined,
      response: new Response(null, { status: 204 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingEventsCancelCreate>
    >);

    const Wrapper = createWrapper();
    const { result } = renderHook(() => usePublicCancel(), {
      wrapper: Wrapper,
    });

    let resolved: unknown = 'not-yet-resolved';
    await act(async () => {
      resolved = await result.current.cancel({ code: 'secret-code' });
    });

    expect(resolved).toBeUndefined();
    expect(publicBookingEventsCancelCreate).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { 'X-Booking-Code': 'secret-code' } })
    );
  });

  it.each([
    ['ALREADY_USED', 409],
    ['EXPIRED', 410],
    ['NOT_PERMITTED', 403],
  ] as const)(
    'rejects with a PublicWriteFailureError for %s (%d)',
    async (errorCode, status) => {
      const responseBody = {
        error_code: errorCode,
        detail: `${errorCode} happened`,
      };
      vi.mocked(publicBookingEventsCancelCreate).mockResolvedValueOnce({
        data: undefined,
        error: responseBody,
        response: new Response(JSON.stringify(responseBody), { status }),
      } as unknown as Awaited<
        ReturnType<typeof publicBookingEventsCancelCreate>
      >);

      const Wrapper = createWrapper();
      const { result } = renderHook(() => usePublicCancel(), {
        wrapper: Wrapper,
      });

      let caught: unknown;
      await act(async () => {
        try {
          await result.current.cancel({ code: 'secret-code' });
        } catch (err) {
          caught = err;
        }
      });

      expect(caught).toBeInstanceOf(PublicWriteFailureError);
      expect((caught as PublicWriteFailureError).failure.errorCode).toBe(
        errorCode
      );
    }
  );

  it('ALREADY_USED and EXPIRED render distinct detail text from each other', async () => {
    const alreadyUsedBody = {
      error_code: 'ALREADY_USED',
      detail: 'This booking code has already been used.',
    };
    const expiredBody = {
      error_code: 'EXPIRED',
      detail: 'This booking code has expired.',
    };
    vi.mocked(publicBookingEventsCancelCreate)
      .mockResolvedValueOnce({
        data: undefined,
        error: alreadyUsedBody,
        response: new Response(JSON.stringify(alreadyUsedBody), {
          status: 409,
        }),
      } as unknown as Awaited<
        ReturnType<typeof publicBookingEventsCancelCreate>
      >)
      .mockResolvedValueOnce({
        data: undefined,
        error: expiredBody,
        response: new Response(JSON.stringify(expiredBody), { status: 410 }),
      } as unknown as Awaited<
        ReturnType<typeof publicBookingEventsCancelCreate>
      >);

    const Wrapper = createWrapper();
    const { result: resultA } = renderHook(() => usePublicCancel(), {
      wrapper: Wrapper,
    });
    const { result: resultB } = renderHook(() => usePublicCancel(), {
      wrapper: Wrapper,
    });

    let caughtA: unknown;
    await act(async () => {
      try {
        await resultA.current.cancel({ code: 'code-a' });
      } catch (err) {
        caughtA = err;
      }
    });
    let caughtB: unknown;
    await act(async () => {
      try {
        await resultB.current.cancel({ code: 'code-b' });
      } catch (err) {
        caughtB = err;
      }
    });

    const failureA = (caughtA as PublicWriteFailureError).failure;
    const failureB = (caughtB as PublicWriteFailureError).failure;
    expect(failureA.detail).not.toEqual(failureB.detail);
  });
});
