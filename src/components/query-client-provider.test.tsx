/**
 * QueryClientProvider wiring tests.
 *
 * Verifies that the QueryCache onError handler is wired to
 * `recoverFromOrganizationQueryError` and that any rejection from the recovery
 * fn is swallowed (fire-and-forget, never becomes an unhandled rejection).
 *
 * Also covers the global `MutationCache.onError` over-limit handler (Phase 8,
 * billing-hardening-gap-closure plan) — THE CRITICAL SUITE here is the
 * pass-through regression: a non-`limit_exceeded` mutation error (a generic
 * failure, or a differently-coded billing error) must leave this handler a
 * complete no-op, proven by asserting `emitRemedy` is never called for those.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';

import type { Subscription } from '@/client';
import { billingSubscriptionRetrieveSubscriptionRetrieveOptions } from '@/client/@tanstack/react-query.gen';

// ---------------------------------------------------------------------------
// Mock recovery module + the remedy bus before importing the provider factory
// ---------------------------------------------------------------------------

// vi.hoisted ensures these are initialized before the vi.mock factories run
// (vi.mock calls are hoisted to the top of the file by Vitest).
const { mockRecover, mockEmitRemedy } = vi.hoisted(() => ({
  mockRecover: vi.fn(),
  mockEmitRemedy: vi.fn(),
}));

vi.mock('@/hooks/organizations/use-organization-error-recovery', () => ({
  recoverFromOrganizationQueryError: mockRecover,
}));

vi.mock('@/lib/billing/remedy-bus', () => ({
  emitRemedy: mockEmitRemedy,
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

// ---------------------------------------------------------------------------
// MutationCache onError — global over-limit handler (Phase 8)
// ---------------------------------------------------------------------------

/** Fires the mutation cache's onError exactly as TanStack Query would. */
function fireMutationError(
  client: QueryClient,
  error: unknown,
  mutationMeta: Record<string, unknown> = {}
) {
  const onError = client.getMutationCache().config.onError;
  const fakeMutation = { meta: mutationMeta };
  onError?.(
    error as never,
    undefined,
    undefined,
    fakeMutation as Parameters<NonNullable<typeof onError>>[3],
    {} as Parameters<NonNullable<typeof onError>>[4]
  );
}

function setSubscription(
  client: QueryClient,
  subscription: Partial<Subscription>
) {
  client.setQueryData(
    billingSubscriptionRetrieveSubscriptionRetrieveOptions().queryKey,
    subscription as Subscription
  );
}

describe('makeQueryClient — MutationCache onError (global over-limit handler)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Pass-through regression — THE critical suite for this phase --------

  it('is a no-op for a generic (non-billing) mutation error', () => {
    const client = makeQueryClient();

    fireMutationError(client, new Error('network exploded'));

    expect(mockEmitRemedy).not.toHaveBeenCalled();
  });

  it('is a no-op for a DRF field-validation 400 (no code, no limit_exceeded shape)', () => {
    const client = makeQueryClient();

    fireMutationError(client, { name: ['This field is required.'] });

    expect(mockEmitRemedy).not.toHaveBeenCalled();
  });

  it('is a no-op for a billing error with a code OTHER than limit_exceeded (e.g. charge_declined)', () => {
    const client = makeQueryClient();

    fireMutationError(client, {
      code: 'charge_declined',
      detail: 'The card was declined.',
    });

    expect(mockEmitRemedy).not.toHaveBeenCalled();
  });

  it('is a no-op for a generic 500-shaped body', () => {
    const client = makeQueryClient();

    fireMutationError(client, { detail: 'Internal server error' });

    expect(mockEmitRemedy).not.toHaveBeenCalled();
  });

  // --- overLimitHandledInline opt-out --------------------------------------

  it('skips a limit_exceeded rejection when the mutation opts out via meta.overLimitHandledInline', () => {
    const client = makeQueryClient();

    fireMutationError(
      client,
      {
        code: 'limit_exceeded',
        resource: 'availability_windows',
        current_usage: 50,
        limit: 50,
        detail: 'Limit reached.',
      },
      { overLimitHandledInline: true }
    );

    expect(mockEmitRemedy).not.toHaveBeenCalled();
  });

  // --- Real over-limit routing ---------------------------------------------

  it('emits resolve_billing for a limit_exceeded rejection when the org is in grace', () => {
    const client = makeQueryClient();
    setSubscription(client, { billing_state: 'grace' } as Subscription);

    fireMutationError(client, {
      code: 'limit_exceeded',
      resource: 'organization_members',
      current_usage: 5,
      limit: 5,
      detail: 'Limit reached.',
    });

    expect(mockEmitRemedy).toHaveBeenCalledWith({
      remedy: 'resolve_billing',
      resource: 'organization_members',
    });
  });

  it('emits purchase_add_on for a limit_exceeded rejection on an add-on-purchasable resource, active org', () => {
    const client = makeQueryClient();
    setSubscription(client, { billing_state: 'active' } as Subscription);

    fireMutationError(client, {
      code: 'limit_exceeded',
      resource: 'event_occurrences',
      current_usage: 100,
      limit: 100,
      detail: 'Limit reached.',
    });

    expect(mockEmitRemedy).toHaveBeenCalledWith({
      remedy: 'purchase_add_on',
      resource: 'event_occurrences',
    });
  });

  it('emits a remedy even when no subscription is cached yet (treated as no billing_state)', () => {
    const client = makeQueryClient();
    // No setSubscription call — cache is cold.

    fireMutationError(client, {
      code: 'limit_exceeded',
      resource: 'event_occurrences',
      current_usage: 1,
      limit: 1,
      detail: 'Limit reached.',
    });

    expect(mockEmitRemedy).toHaveBeenCalledWith({
      remedy: 'purchase_add_on',
      resource: 'event_occurrences',
    });
  });

  it('never throws out of the mutation pipeline even if emitting the remedy blows up', () => {
    const client = makeQueryClient();
    setSubscription(client, { billing_state: 'active' } as Subscription);
    // Simulate a bug downstream (the bus/RemedyRouter) — the handler must
    // swallow it, same best-effort convention as the QueryCache recovery
    // path above, so a routing bug can never break the mutation's own
    // pipeline.
    mockEmitRemedy.mockImplementationOnce(() => {
      throw new Error('bus exploded');
    });

    expect(() =>
      fireMutationError(client, {
        code: 'limit_exceeded',
        resource: 'event_occurrences',
        current_usage: 1,
        limit: 1,
        detail: 'Limit reached.',
      })
    ).not.toThrow();
  });
});
