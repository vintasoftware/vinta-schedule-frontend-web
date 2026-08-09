/**
 * useAwaitPaymentConfirmation tests.
 *
 * The confirmation race is the phase's highest-risk area, so these pin the
 * three behaviours that matter:
 * - resolves `confirmed` the first time the polled state flips resolved;
 * - falls back to `still_processing` at the timeout ceiling (never spins
 *   forever, never claims success off nothing);
 * - clears its timer on unmount — no poll fires after the component is gone.
 *
 * All three use fake timers so the ~3s/~60s bounds are exercised deterministically.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import {
  useAwaitPaymentConfirmation,
  CONFIRMATION_POLL_INTERVAL_MS,
  CONFIRMATION_TIMEOUT_MS,
} from './use-await-payment-confirmation';

interface Polled {
  done: boolean;
}

describe('useAwaitPaymentConfirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves confirmed once the polled state flips resolved', async () => {
    let done = false;
    const poll = vi.fn(async (): Promise<Polled> => ({ done }));
    const { result } = renderHook(() =>
      useAwaitPaymentConfirmation<Polled>({
        poll,
        isResolved: (value) => value.done,
      })
    );

    let pending!: Promise<{ status: string }>;
    act(() => {
      pending = result.current.start();
    });
    expect(result.current.status).toBe('awaiting');

    // Immediate poll fires at start (before the first interval): still pending.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(poll).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('awaiting');

    // First interval poll: still pending, keeps going.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS);
    });
    expect(poll).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('awaiting');

    // The webhook lands — the next poll sees it resolved.
    done = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS);
    });

    await expect(pending).resolves.toEqual({ status: 'confirmed' });
    expect(result.current.status).toBe('confirmed');
  });

  it('resolves confirmed on the immediate poll when the state is already settled', async () => {
    // Webhook already landed before start() — must not wait a full interval.
    const poll = vi.fn(async (): Promise<Polled> => ({ done: true }));
    const { result } = renderHook(() =>
      useAwaitPaymentConfirmation<Polled>({
        poll,
        isResolved: (value) => value.done,
      })
    );

    let pending!: Promise<{ status: string }>;
    act(() => {
      pending = result.current.start();
    });

    // Flush the immediate poll's microtasks without advancing a full interval.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await expect(pending).resolves.toEqual({ status: 'confirmed' });
    expect(result.current.status).toBe('confirmed');
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('falls back to still_processing at the timeout ceiling', async () => {
    const poll = vi.fn(async (): Promise<Polled> => ({ done: false }));
    const { result } = renderHook(() =>
      useAwaitPaymentConfirmation<Polled>({
        poll,
        isResolved: (value) => value.done,
      })
    );

    let pending!: Promise<{ status: string }>;
    act(() => {
      pending = result.current.start();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRMATION_TIMEOUT_MS);
    });

    await expect(pending).resolves.toEqual({ status: 'still_processing' });
    expect(result.current.status).toBe('still_processing');
    // It polled along the way but never claimed success.
    expect(poll).toHaveBeenCalled();
  });

  it('stops polling on unmount — no poll fires afterwards', async () => {
    const poll = vi.fn(async (): Promise<Polled> => ({ done: false }));
    const { result, unmount } = renderHook(() =>
      useAwaitPaymentConfirmation<Polled>({
        poll,
        isResolved: (value) => value.done,
      })
    );

    act(() => {
      void result.current.start();
    });

    // One immediate poll at start, one at the first interval.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS);
    });
    expect(poll).toHaveBeenCalledTimes(2);

    unmount();

    // Nothing should poll after the component is gone.
    await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS * 5);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('resolves still_processing when unmounted mid-wait so an awaiting caller does not hang', async () => {
    const poll = vi.fn(async (): Promise<Polled> => ({ done: false }));
    const { result, unmount } = renderHook(() =>
      useAwaitPaymentConfirmation<Polled>({
        poll,
        isResolved: (value) => value.done,
      })
    );

    let pending!: Promise<{ status: string }>;
    act(() => {
      pending = result.current.start();
    });

    unmount();

    await expect(pending).resolves.toEqual({ status: 'still_processing' });
  });

  it('honours overridden interval and timeout bounds', async () => {
    const poll = vi.fn(async (): Promise<Polled> => ({ done: false }));
    const { result } = renderHook(() =>
      useAwaitPaymentConfirmation<Polled>({
        poll,
        isResolved: (value) => value.done,
        intervalMs: 100,
        timeoutMs: 250,
      })
    );

    let pending!: Promise<{ status: string }>;
    act(() => {
      pending = result.current.start();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    await expect(pending).resolves.toEqual({ status: 'still_processing' });
    // Immediate poll at start plus two intervals (100ms, 200ms) before the
    // 250ms ceiling.
    expect(poll).toHaveBeenCalledTimes(3);
  });
});
