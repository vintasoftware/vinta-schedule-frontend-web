/**
 * idempotency.ts — a per-attempt idempotency-key holder.
 *
 * `change-plan` and `add-ons` both require an `idempotency_key`. The API is
 * idempotent per key, but only if the client REUSES the same key across retries
 * of one attempt — a network retry or double-click must not mint a second key,
 * or it double-charges (Guiding Decision: "Idempotency keys are generated per
 * purchase attempt, client-side"; Risk notes: "Idempotency is the frontend's
 * job to preserve").
 *
 * The holder mints a key lazily on first read and holds it stable until
 * `reset()` starts a genuinely new attempt.
 */

/** A per-attempt idempotency-key holder: `key` is stable until `reset()`. */
export interface IdempotencyKeyHolder {
  /** The current attempt's key — the same value across retries until reset. */
  readonly key: string;
  /** Start a new attempt: the next `key` read mints a fresh UUID. */
  reset(): void;
}

/**
 * Creates a per-attempt idempotency-key holder. The first `key` access mints a
 * `crypto.randomUUID()`; subsequent accesses return that same value (retries of
 * the same attempt). `reset()` clears it so the next access mints a new one (a
 * new attempt).
 */
export function createIdempotencyKeyHolder(): IdempotencyKeyHolder {
  let current: string | null = null;

  return {
    get key(): string {
      if (current === null) {
        current = crypto.randomUUID();
      }
      return current;
    },
    reset(): void {
      current = null;
    },
  };
}
