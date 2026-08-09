/**
 * idempotency.ts tests.
 *
 * Covers:
 * - the key is stable across repeated reads within one attempt (a retry /
 *   double-click reuses it — the double-charge guard)
 * - reset() mints a fresh key for the next attempt
 */

import { describe, it, expect } from 'vitest';
import { createIdempotencyKeyHolder } from './idempotency';

describe('createIdempotencyKeyHolder', () => {
  it('returns a stable key across reads within one attempt', () => {
    const holder = createIdempotencyKeyHolder();
    const first = holder.key;
    const second = holder.key;
    // A retry of the same attempt must reuse the same key — this is what makes
    // the API idempotent and prevents a double-charge on retry/double-click.
    expect(second).toBe(first);
  });

  it('mints a fresh key after reset()', () => {
    const holder = createIdempotencyKeyHolder();
    const first = holder.key;
    holder.reset();
    const second = holder.key;
    expect(second).not.toBe(first);
  });

  it('mints a valid UUID', () => {
    const holder = createIdempotencyKeyHolder();
    expect(holder.key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});
