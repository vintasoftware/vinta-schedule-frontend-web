/**
 * PurchaseAddOnDialog — REAL confirmation-predicate coverage.
 *
 * The sibling `purchase-add-on-dialog.test.tsx` mocks
 * `useAwaitPaymentConfirmation` to drive the UI branches, so nothing there
 * exercises the actual `poll` / `isResolved` wiring. This suite deliberately
 * leaves the confirmation hook UNMOCKED and instead controls the subscription
 * `refetch`, so the real predicate runs. It guards the money-path invariant
 * that a not-yet-readable add-on can NEVER settle as confirmed:
 *   • the add-on ABSENT from `add_ons[]` (write not yet readable),
 *   • an `undefined` subscription read (refetch resolving before the row),
 *   • the add-on present but `is_active` still false (webhook not landed)
 * all keep polling — confirmation waits for the RETURNED add-on's `is_active`
 * to flip true. Fake timers drive the ~3s poll cadence, as the hook's own tests
 * do.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import type { ResourceKeyEnum, Subscription } from '@/client';
import { CONFIRMATION_POLL_INTERVAL_MS } from '@/hooks/billing/use-await-payment-confirmation';

// ---- mocks -----------------------------------------------------------------

const h = vi.hoisted(() => ({
  purchaseAddOn: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('@/hooks/billing/use-purchase-add-on', () => ({
  usePurchaseAddOn: () => ({
    purchaseAddOn: h.purchaseAddOn,
    purchaseAddOnMutation: { isPending: false },
  }),
}));

vi.mock('@/hooks/billing/use-subscription', () => ({
  useSubscription: () => ({
    subscription: null,
    subscriptionQuery: { refetch: h.refetch },
  }),
}));

// NOTE: useAwaitPaymentConfirmation is intentionally NOT mocked here — this
// suite exercises the REAL poll/isResolved predicate via the refetch above.

vi.mock('./payment-instrument-field', () => ({
  PaymentInstrumentField: React.forwardRef(function MockField(_props, ref) {
    React.useImperativeHandle(ref, () => ({
      tokenize: async () => ({ status: 'tokenized', token: 'tok_test' }),
    }));
    return React.createElement('div', { 'data-testid': 'mock-payment-field' });
  }),
}));

import { PurchaseAddOnDialog } from './purchase-add-on-dialog';

// ---- fixtures --------------------------------------------------------------

const RESOURCE: ResourceKeyEnum = 'event_occurrences';

const PAID_SUBSCRIPTION = {
  id: 1,
  billing_state: 'active',
  billing_interval: 'monthly',
  add_ons: [],
} as unknown as Subscription;

/** A subscription whose `add_ons[]` holds the given add-on rows. */
function subscriptionWithAddOns(
  addOns: Array<{ id: number; is_active: boolean }>
): Subscription {
  return {
    ...PAID_SUBSCRIPTION,
    add_ons: addOns.map((a) => ({
      id: a.id,
      resource_key: RESOURCE,
      quantity: 100,
      is_recurring: true,
      is_active: a.is_active,
      external_id: 'ext',
      created: '2026-08-09T00:00:00Z',
    })),
  } as unknown as Subscription;
}

describe('PurchaseAddOnDialog — real confirmation predicate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // The initiate returns the add-on (id 42) with `is_active` false — the
    // webhook has not yet landed.
    h.purchaseAddOn.mockResolvedValue({
      id: 42,
      resource_key: RESOURCE,
      quantity: 100,
      is_recurring: true,
      is_active: false,
      external_id: '',
      created: '2026-08-09T00:00:00Z',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps polling on an absent add-on and an undefined read, confirming only once is_active flips', async () => {
    h.refetch
      // Poll 1 (immediate): the add-on is ABSENT from add_ons[] → keep polling.
      .mockResolvedValueOnce({ data: subscriptionWithAddOns([]) })
      // Poll 2: a not-yet-readable subscription (undefined) → must NEVER confirm.
      .mockResolvedValueOnce({ data: undefined })
      // Poll 3: the add-on is present but still inactive → keep polling.
      .mockResolvedValueOnce({
        data: subscriptionWithAddOns([{ id: 42, is_active: false }]),
      })
      // Poll 4: is_active flips true → confirmed.
      .mockResolvedValueOnce({
        data: subscriptionWithAddOns([{ id: 42, is_active: true }]),
      });

    render(
      <PurchaseAddOnDialog
        open
        onOpenChange={() => {}}
        resourceKey={RESOURCE}
        subscription={PAID_SUBSCRIPTION}
      />
    );

    fireEvent.click(screen.getByTestId('purchase-add-on-submit'));

    // Flush the initiate + immediate poll: add-on absent → confirming, and
    // crucially NOT confirmed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      screen.getByTestId('purchase-add-on-confirming')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('purchase-add-on-confirmed')
    ).not.toBeInTheDocument();

    // Poll 2 returns undefined → still confirming, still NOT confirmed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS);
    });
    expect(
      screen.getByTestId('purchase-add-on-confirming')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('purchase-add-on-confirmed')
    ).not.toBeInTheDocument();

    // Poll 3: present but inactive → still confirming, still NOT confirmed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS);
    });
    expect(
      screen.getByTestId('purchase-add-on-confirming')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('purchase-add-on-confirmed')
    ).not.toBeInTheDocument();

    // Poll 4: is_active true → the real predicate resolves → confirmed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS);
    });
    expect(screen.getByTestId('purchase-add-on-confirmed')).toBeInTheDocument();
  });
});
