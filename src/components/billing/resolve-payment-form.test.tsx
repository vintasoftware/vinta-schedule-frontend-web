/**
 * ResolvePaymentForm tests — the money-path recovery invariants (Phase 5).
 *
 * `useChangePlan` / `useSubscription` and the card field are mocked so the test
 * drives the flow deterministically, but the async-confirmation hook is left
 * REAL: the load-bearing behavior is that recovery confirms ONLY on a real
 * subscription read back to `active`, and a still-GRACE or a null/undefined read
 * must keep polling — never render "recovered" early. The `isRecoveryConfirmed`
 * predicate is also asserted directly for those three cases.
 *
 * The load-bearing behaviors:
 *   • submit RE-AFFIRMS the current plan (its slug + interval) with the fresh
 *     token + a per-attempt idempotency key;
 *   • a retried submit REUSES the same idempotency key (never double-charges);
 *   • an `active` poll lands the confirmed state; a still-GRACE poll stays in the
 *     confirming state (does not confirm);
 *   • the grace deadline renders.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import type { Subscription } from '@/client';

import { isRecoveryConfirmed } from './resolve-payment-form';

// ---- mocks -----------------------------------------------------------------

const h = vi.hoisted(() => ({
  changePlan: vi.fn(),
  refetch: vi.fn(),
  tokenizeResult: { status: 'tokenized', token: 'tok_new' } as {
    status: string;
    token?: string;
    reason?: string;
    message?: string;
  },
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

vi.mock('./payment-instrument-field', () => ({
  PaymentInstrumentField: React.forwardRef(function MockField(_props, ref) {
    React.useImperativeHandle(ref, () => ({
      tokenize: async () => h.tokenizeResult,
    }));
    return React.createElement('div', { 'data-testid': 'mock-payment-field' });
  }),
}));

import { ResolvePaymentForm } from './resolve-payment-form';

// ---- fixtures --------------------------------------------------------------

const GRACE_SUBSCRIPTION = {
  id: 1,
  plan: {
    id: 2,
    slug: 'team',
    name: 'Team',
    currency: 'USD',
    monthly_price: '20.0000',
    annual_price: '200.0000',
  },
  billing_state: 'grace',
  billing_interval: 'monthly',
  grace_period_ends_at: '2026-09-01T12:00:00Z',
  pending_plan_slug: '',
} as unknown as Subscription;

const ACTIVE_SUBSCRIPTION = {
  ...GRACE_SUBSCRIPTION,
  billing_state: 'active',
} as unknown as Subscription;

function renderForm(subscription: Subscription = GRACE_SUBSCRIPTION) {
  return render(<ResolvePaymentForm subscription={subscription} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.tokenizeResult = { status: 'tokenized', token: 'tok_new' };
  // Default initiate: change-plan returns before the webhook (still grace).
  h.changePlan.mockResolvedValue(GRACE_SUBSCRIPTION);
  // Default poll: the org has recovered to ACTIVE.
  h.refetch.mockResolvedValue({ data: ACTIVE_SUBSCRIPTION });
});

// ---- the confirm predicate (real, unmocked) --------------------------------

describe('isRecoveryConfirmed', () => {
  it('does NOT confirm a null read (keeps polling)', () => {
    expect(isRecoveryConfirmed(null)).toBe(false);
  });

  it('does NOT confirm an undefined read (keeps polling)', () => {
    expect(isRecoveryConfirmed(undefined)).toBe(false);
  });

  it('does NOT confirm a still-GRACE read (keeps polling)', () => {
    expect(isRecoveryConfirmed(GRACE_SUBSCRIPTION)).toBe(false);
  });

  it('does NOT confirm a still-RESTRICTED read (keeps polling)', () => {
    expect(
      isRecoveryConfirmed({
        ...GRACE_SUBSCRIPTION,
        billing_state: 'restricted',
      } as unknown as Subscription)
    ).toBe(false);
  });

  it('confirms ONLY a real subscription back to ACTIVE', () => {
    expect(isRecoveryConfirmed(ACTIVE_SUBSCRIPTION)).toBe(true);
  });
});

// ---- the form flow ---------------------------------------------------------

describe('ResolvePaymentForm', () => {
  it('renders the grace deadline and the current plan being kept', () => {
    renderForm();

    expect(screen.getByTestId('resolve-payment-deadline')).toBeInTheDocument();
    // The plan the org keeps — re-affirmed, not chosen.
    expect(screen.getByTestId('resolve-payment-plan')).toHaveTextContent(
      'Team'
    );
    expect(screen.getByTestId('resolve-payment-price')).toHaveTextContent(
      '$20.00'
    );
  });

  it('re-affirms the CURRENT plan with the fresh token + an idempotency key, then polls to ACTIVE', async () => {
    renderForm();

    fireEvent.click(screen.getByTestId('resolve-payment-submit'));

    await waitFor(() => expect(h.changePlan).toHaveBeenCalledTimes(1));
    const body = h.changePlan.mock.calls[0][0];
    expect(body).toMatchObject({
      plan_slug: 'team', // the CURRENT plan's slug — re-affirmed
      billing_interval: 'monthly', // the CURRENT interval
      payment_token: 'tok_new', // a FRESH instrument
    });
    expect(body.idempotency_key).toBeTruthy();

    // The real confirmation hook polls; the ACTIVE read lands the confirmed UI.
    await waitFor(() =>
      expect(
        screen.getByTestId('resolve-payment-confirmed')
      ).toBeInTheDocument()
    );
    expect(h.refetch).toHaveBeenCalled();
  });

  it('a still-GRACE poll does NOT confirm — it stays in the confirming state', async () => {
    // The webhook has not landed: every read is still GRACE.
    h.refetch.mockResolvedValue({ data: GRACE_SUBSCRIPTION });

    renderForm();
    fireEvent.click(screen.getByTestId('resolve-payment-submit'));

    await waitFor(() =>
      expect(
        screen.getByTestId('resolve-payment-confirming')
      ).toBeInTheDocument()
    );
    // It must NOT have jumped to a confirmed state off a still-GRACE read.
    expect(
      screen.queryByTestId('resolve-payment-confirmed')
    ).not.toBeInTheDocument();
  });

  it('reuses the SAME idempotency key across a retried submit', async () => {
    // First initiate fails (a transient 409); the second succeeds.
    h.changePlan
      .mockRejectedValueOnce({ detail: 'A change is already processing.' })
      .mockResolvedValueOnce(GRACE_SUBSCRIPTION);

    renderForm();

    // First submit → error surfaces, form stays.
    fireEvent.click(screen.getByTestId('resolve-payment-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('resolve-payment-error')).toBeInTheDocument()
    );

    // Second submit (retry) → succeeds, reusing the same key.
    fireEvent.click(screen.getByTestId('resolve-payment-submit'));
    await waitFor(() => expect(h.changePlan).toHaveBeenCalledTimes(2));

    const firstKey = h.changePlan.mock.calls[0][0].idempotency_key;
    const secondKey = h.changePlan.mock.calls[1][0].idempotency_key;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });

  it('surfaces the over-limit message on a 402', async () => {
    h.changePlan.mockRejectedValueOnce({
      code: 'limit_exceeded',
      resource: 'organization_members',
      current_usage: 10,
      limit: 5,
      detail: 'You have 10 members but Team allows 5.',
    });

    renderForm();
    fireEvent.click(screen.getByTestId('resolve-payment-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('resolve-payment-error')).toHaveTextContent(
        'You have 10 members but Team allows 5.'
      )
    );
  });

  it('does not call change-plan when tokenization fails', async () => {
    h.tokenizeResult = {
      status: 'error',
      reason: 'incomplete',
      message: 'Your card is incomplete.',
    };

    renderForm();
    fireEvent.click(screen.getByTestId('resolve-payment-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('resolve-payment-error')).toBeInTheDocument()
    );
    expect(h.changePlan).not.toHaveBeenCalled();
  });
});
