/**
 * useAwaitPaymentConfirmation — the async-confirmation polling primitive
 * (Phase 1; Guiding Decision "Payment success is asynchronous; the UI polls").
 *
 * Capacity/plan grant happens on a provider WEBHOOK the frontend never sees:
 * `POST /billing/add-ons/` returns `201` and `change-plan` returns with
 * `pending_*` set BEFORE the charge confirms. So every purchase/recovery flow
 * (Phases 3/4/5) must poll the subscription/add-on until the webhook-driven
 * state resolves, then fall back to a calm "still processing" state — never an
 * indefinite spinner, never "done" off the initiate response alone.
 *
 * This hook encapsulates that once: `start()` polls `poll()` every
 * `CONFIRMATION_POLL_INTERVAL_MS` for up to `CONFIRMATION_TIMEOUT_MS`, resolving
 * `confirmed` the first time `isResolved(value)` is true, or `still_processing`
 * at the ceiling. It clears its timers on unmount and on resolution, so no
 * interval leaks past the component's life (the confirmation race — declaring
 * success early or polling forever — is the high-risk bug this guards against).
 *
 * The interval + ceiling live here as the single tuning point for every flow.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Poll cadence — re-read the subscription/add-on this often. */
export const CONFIRMATION_POLL_INTERVAL_MS = 3_000;
/** Upper bound — stop polling and fall back to "still processing" after this. */
export const CONFIRMATION_TIMEOUT_MS = 60_000;

export type PaymentConfirmationStatus =
  | 'idle'
  | 'awaiting'
  | 'confirmed'
  | 'still_processing';

/** The terminal outcome `start()` resolves to. */
export interface PaymentConfirmationResult {
  status: 'confirmed' | 'still_processing';
}

export interface UseAwaitPaymentConfirmationOptions<T> {
  /**
   * Re-reads the latest state to evaluate — typically a TanStack Query
   * `refetch()` returning the fresh subscription/add-on.
   */
  poll: () => Promise<T> | T;
  /** True once the webhook-driven state has resolved (e.g. `pending_*` cleared). */
  isResolved: (value: T) => boolean;
  /** Override the poll cadence (defaults to `CONFIRMATION_POLL_INTERVAL_MS`). */
  intervalMs?: number;
  /** Override the ceiling (defaults to `CONFIRMATION_TIMEOUT_MS`). */
  timeoutMs?: number;
}

export interface UseAwaitPaymentConfirmationResult {
  /** Current polling status; drives the pending/settled UI. */
  status: PaymentConfirmationStatus;
  /**
   * Begin awaiting confirmation. Resolves `confirmed` on the first resolved
   * poll, or `still_processing` at the timeout ceiling. Calling it again while
   * awaiting restarts the wait.
   */
  start: () => Promise<PaymentConfirmationResult>;
  /** Stop any in-flight polling and return to `idle`. */
  reset: () => void;
}

export function useAwaitPaymentConfirmation<T>({
  poll,
  isResolved,
  intervalMs = CONFIRMATION_POLL_INTERVAL_MS,
  timeoutMs = CONFIRMATION_TIMEOUT_MS,
}: UseAwaitPaymentConfirmationOptions<T>): UseAwaitPaymentConfirmationResult {
  const [status, setStatus] = useState<PaymentConfirmationStatus>('idle');

  // Latest callbacks, read from the poll loop so a re-render mid-wait doesn't
  // capture a stale closure. Synced in an effect (never written during render).
  const pollRef = useRef(poll);
  const isResolvedRef = useRef(isResolved);
  useEffect(() => {
    pollRef.current = poll;
    isResolvedRef.current = isResolved;
  });

  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Resolver for the in-flight `start()` promise, so teardown can settle a wait
  // that would otherwise hang the awaiting caller. Cleared on every settle.
  const resolveRef = useRef<
    ((result: PaymentConfirmationResult) => void) | null
  >(null);
  // Guards every post-await state write: once cleared (resolution or unmount),
  // an in-flight poll that resolves later is a no-op — no leaked timer, no
  // set-state-after-unmount, no confirming a wait that was already torn down.
  const activeRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    clearTimers();
  }, [clearTimers]);

  const reset = useCallback(() => {
    stop();
    setStatus('idle');
  }, [stop]);

  const start = useCallback((): Promise<PaymentConfirmationResult> => {
    // Restart cleanly if a previous wait is still running.
    stop();
    activeRef.current = true;
    setStatus('awaiting');

    return new Promise<PaymentConfirmationResult>((resolve) => {
      resolveRef.current = resolve;

      const settle = (result: PaymentConfirmationResult) => {
        if (!activeRef.current) return;
        stop();
        resolveRef.current = null;
        setStatus(result.status);
        resolve(result);
      };

      const tick = async () => {
        if (!activeRef.current) return;
        let value: T;
        try {
          value = await pollRef.current();
        } catch {
          // A transient read error is not a verdict — keep polling until the
          // ceiling. The webhook may still land.
          return;
        }
        if (!activeRef.current) return;
        if (isResolvedRef.current(value)) settle({ status: 'confirmed' });
      };

      // Poll once immediately so an already-settled webhook resolves without
      // waiting a full interval; the interval then covers the not-yet-settled
      // case up to the ceiling.
      void tick();
      intervalIdRef.current = setInterval(() => {
        void tick();
      }, intervalMs);
      timeoutIdRef.current = setTimeout(() => {
        settle({ status: 'still_processing' });
      }, timeoutMs);
    });
  }, [stop, intervalMs, timeoutMs]);

  // On unmount mid-wait: stop timers (no poll fires after unmount) AND resolve
  // the in-flight promise with `still_processing` so an awaiting caller doesn't
  // hang. The `activeRef` guard still blocks any post-unmount state write.
  useEffect(
    () => () => {
      stop();
      resolveRef.current?.({ status: 'still_processing' });
      resolveRef.current = null;
    },
    [stop]
  );

  return { status, start, reset };
}
