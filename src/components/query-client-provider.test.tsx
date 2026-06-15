/**
 * QueryClientProvider wiring tests.
 *
 * Verifies that the QueryCache onError handler is wired to
 * `recoverFromOrganizationQueryError` and that any rejection from the recovery
 * fn is swallowed (fire-and-forget, never becomes an unhandled rejection).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock recovery module before importing the provider factory
// ---------------------------------------------------------------------------

// vi.hoisted ensures mockRecover is initialized before the vi.mock factory runs
// (vi.mock calls are hoisted to the top of the file by Vitest).
const { mockRecover } = vi.hoisted(() => ({ mockRecover: vi.fn() }));

vi.mock('@/hooks/organizations/use-organization-error-recovery', () => ({
  recoverFromOrganizationQueryError: mockRecover,
}));

import { makeQueryClient } from './query-client-provider';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('makeQueryClient — QueryCache onError wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecover.mockResolvedValue('ignored');
  });

  it('calls recoverFromOrganizationQueryError with the error and the client instance', () => {
    const client = makeQueryClient();
    // The cache onError types its first arg as DefaultError (Error), but the
    // recovery fn accepts unknown (matches real backend shape). Cast to satisfy
    // the call-site type while preserving the realistic fixture value.
    const error = {
      detail: 'X-Organization-Id header required.',
    } as unknown as Error;

    // Simulate the cache firing onError (e.g. after a failing query).
    const onError = client.getQueryCache().config.onError;
    // onError signature: (error, query) — query is not used by the recovery fn.
    onError?.(error, {} as Parameters<NonNullable<typeof onError>>[1]);

    expect(mockRecover).toHaveBeenCalledTimes(1);
    expect(mockRecover).toHaveBeenCalledWith(error, client);
  });

  it('swallows a rejection from the recovery fn (no unhandled promise rejection)', async () => {
    mockRecover.mockRejectedValue(new Error('recovery exploded'));
    const client = makeQueryClient();
    const error = {
      detail: 'X-Organization-Id header required.',
    } as unknown as Error;

    const onError = client.getQueryCache().config.onError;

    // Trigger and flush microtasks — must not throw.
    await expect(
      Promise.resolve().then(() => {
        onError?.(error, {} as Parameters<NonNullable<typeof onError>>[1]);
      })
    ).resolves.toBeUndefined();

    // Give the fire-and-forget promise time to settle.
    await new Promise((r) => setTimeout(r, 0));

    // If we reach here without an unhandled rejection the test passes.
    expect(mockRecover).toHaveBeenCalledTimes(1);
  });
});
