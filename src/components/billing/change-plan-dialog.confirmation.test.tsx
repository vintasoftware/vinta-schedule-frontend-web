/**
 * ChangePlanDialog — REAL confirmation-predicate coverage.
 *
 * The sibling `change-plan-dialog.test.tsx` mocks `useAwaitPaymentConfirmation`
 * to drive the UI branches deterministically, so nothing there exercises the
 * actual `poll` / `isResolved` wiring. This suite deliberately leaves the
 * confirmation hook UNMOCKED and instead controls the subscription `refetch`,
 * so the real predicate runs. It guards the money-path invariant that a
 * not-yet-readable subscription (a `null`/`undefined` read) can NEVER settle as
 * confirmed — success must wait for a real subscription with `pending_plan_slug`
 * cleared. Fake timers drive the ~3s poll cadence, as the hook's own tests do.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import type { BillingPlan, Subscription } from '@/client';
import { CONFIRMATION_POLL_INTERVAL_MS } from '@/hooks/billing/use-await-payment-confirmation';

// ---- mocks -----------------------------------------------------------------

const h = vi.hoisted(() => ({
  changePlan: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('@/hooks/billing/use-change-plan', () => ({
  useChangePlan: () => ({
    changePlan: h.changePlan,
    changePlanMutation: { isPending: false },
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

import { ChangePlanDialog } from './change-plan-dialog';

// ---- fixtures --------------------------------------------------------------

const PLAN: BillingPlan = {
  id: 2,
  slug: 'team',
  name: 'Team',
  is_active: true,
  is_default_for_new_organizations: false,
  monthly_price: '20.0000',
  annual_price: '200.0000',
  currency: 'USD',
  grace_period_days: 7,
  limits: [],
  entitlements: [],
};

const PAID_SUBSCRIPTION = {
  id: 1,
  plan: { ...PLAN, slug: 'starter', name: 'Starter' },
  billing_state: 'active',
  billing_interval: 'monthly',
  pending_plan_slug: '',
} as unknown as Subscription;

describe('ChangePlanDialog — real confirmation predicate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // The initiate returns the subscription with `pending_*` set (webhook not
    // yet landed) and a null `pending_plan_effective_at` — an
    // immediate/charged change, so the dialog polls.
    h.changePlan.mockResolvedValue({
      ...PAID_SUBSCRIPTION,
      pending_plan_slug: 'team',
      pending_plan_effective_at: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays confirming while pending is set, never confirms on a null read, and confirms only once pending clears', async () => {
    h.refetch
      // Poll 1 (immediate): pending STILL set → keep polling, stay confirming.
      .mockResolvedValueOnce({
        data: { ...PAID_SUBSCRIPTION, pending_plan_slug: 'team' },
      })
      // Poll 2: a not-yet-readable subscription → must NEVER confirm (BLOCKER).
      .mockResolvedValueOnce({ data: undefined })
      // Poll 3: pending CLEARED → confirmed.
      .mockResolvedValueOnce({
        data: { ...PAID_SUBSCRIPTION, pending_plan_slug: '' },
      });

    render(
      <ChangePlanDialog
        open
        onOpenChange={() => {}}
        plan={PLAN}
        billingInterval='monthly'
        subscription={PAID_SUBSCRIPTION}
      />
    );

    fireEvent.click(screen.getByTestId('change-plan-submit'));

    // Flush the initiate + immediate poll: pending still set → confirming, and
    // crucially NOT confirmed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('change-plan-confirming')).toBeInTheDocument();
    expect(
      screen.queryByTestId('change-plan-confirmed')
    ).not.toBeInTheDocument();

    // Poll 2 returns null/undefined → still confirming, still NOT confirmed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS);
    });
    expect(screen.getByTestId('change-plan-confirming')).toBeInTheDocument();
    expect(
      screen.queryByTestId('change-plan-confirmed')
    ).not.toBeInTheDocument();

    // Poll 3: pending cleared → the real predicate resolves → confirmed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS);
    });
    expect(screen.getByTestId('change-plan-confirmed')).toBeInTheDocument();
  });
});
