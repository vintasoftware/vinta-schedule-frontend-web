/**
 * ChangePlanDialog tests — the money-path invariants.
 *
 * All data hooks are mocked so the test drives the flow deterministically; the
 * error readers in `@/lib/utils/api-errors` run for real (that parsing is what
 * routes 400/402/409). The four load-bearing behaviors:
 *   • a first-time upgrade (free org) shows the card field and sends the token;
 *   • a returning (paying) org upgrades without re-collecting a card;
 *   • a retried submit REUSES the same idempotency key (never double-charges);
 *   • 402 shows the over-limit message, 409 shows "already processing", and a
 *     successful initiate shows the polled PENDING state (never "done").
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import type { BillingPlan, Subscription } from '@/client';

// ---- mocks -----------------------------------------------------------------

const h = vi.hoisted(() => ({
  changePlan: vi.fn(),
  start: vi.fn(),
  reset: vi.fn(),
  refetch: vi.fn(),
  tokenizeResult: { status: 'tokenized', token: 'tok_test' } as {
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

vi.mock('@/hooks/billing/use-await-payment-confirmation', () => ({
  useAwaitPaymentConfirmation: () => ({
    status: 'idle',
    start: h.start,
    reset: h.reset,
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

function renderDialog(subscription: Subscription | null) {
  return render(
    <ChangePlanDialog
      open
      onOpenChange={() => {}}
      plan={PLAN}
      billingInterval='monthly'
      subscription={subscription}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.tokenizeResult = { status: 'tokenized', token: 'tok_test' };
  // Default: a resolved (confirmed) initiate.
  h.changePlan.mockResolvedValue({
    ...PAID_SUBSCRIPTION,
    pending_plan_slug: 'team',
  });
  h.start.mockResolvedValue({ status: 'confirmed' });
  h.refetch.mockResolvedValue({ data: PAID_SUBSCRIPTION });
});

describe('ChangePlanDialog', () => {
  it('first-time upgrade (free org) shows the card field and sends the token', async () => {
    renderDialog(null);

    // No paid instrument yet → the card field is shown up-front.
    expect(screen.getByTestId('mock-payment-field')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('change-plan-submit'));

    await waitFor(() => expect(h.changePlan).toHaveBeenCalledTimes(1));
    expect(h.changePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_slug: 'team',
        billing_interval: 'monthly',
        payment_token: 'tok_test',
      })
    );
  });

  it('a returning (paying) org upgrades without re-collecting a card', async () => {
    renderDialog(PAID_SUBSCRIPTION);

    // Already has an instrument on file → no card field.
    expect(screen.queryByTestId('mock-payment-field')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('change-plan-submit'));

    await waitFor(() => expect(h.changePlan).toHaveBeenCalledTimes(1));
    expect(h.changePlan.mock.calls[0][0]).toMatchObject({
      plan_slug: 'team',
      payment_token: undefined,
    });
  });

  it('reuses the SAME idempotency key across a retried submit', async () => {
    // First initiate: the API rejects because a token is required (first-time
    // attach). Second initiate (after the card field appears): succeeds.
    h.changePlan
      .mockRejectedValueOnce({ detail: 'A payment token is required.' })
      .mockResolvedValueOnce({
        ...PAID_SUBSCRIPTION,
        pending_plan_slug: 'team',
      });

    renderDialog(PAID_SUBSCRIPTION);

    // First submit → 400 token-required → reveals the card field.
    fireEvent.click(screen.getByTestId('change-plan-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('mock-payment-field')).toBeInTheDocument()
    );
    expect(screen.getByTestId('change-plan-error')).toHaveTextContent(
      /add a payment method/i
    );

    // Second submit (retry) → now sends the token.
    fireEvent.click(screen.getByTestId('change-plan-submit'));
    await waitFor(() => expect(h.changePlan).toHaveBeenCalledTimes(2));

    const firstKey = h.changePlan.mock.calls[0][0].idempotency_key;
    const secondKey = h.changePlan.mock.calls[1][0].idempotency_key;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });

  it('renders the over-limit message on a 402', async () => {
    h.changePlan.mockRejectedValueOnce({
      code: 'limit_exceeded',
      resource: 'organization_members',
      current_usage: 10,
      limit: 5,
      detail: 'You have 10 members but Team allows 5.',
    });

    renderDialog(PAID_SUBSCRIPTION);
    fireEvent.click(screen.getByTestId('change-plan-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('change-plan-error')).toHaveTextContent(
        'You have 10 members but Team allows 5.'
      )
    );
  });

  it('renders "already processing" on a 409', async () => {
    h.changePlan.mockRejectedValueOnce({
      detail: 'A plan change is already awaiting confirmation.',
    });

    renderDialog(PAID_SUBSCRIPTION);
    fireEvent.click(screen.getByTestId('change-plan-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('change-plan-error')).toHaveTextContent(
        /already awaiting confirmation/i
      )
    );
  });

  it('shows the pending confirmation state after a successful initiate', async () => {
    // A confirmation that never resolves during the test → the pending UI stays.
    h.start.mockReturnValue(new Promise(() => {}));

    renderDialog(PAID_SUBSCRIPTION);
    fireEvent.click(screen.getByTestId('change-plan-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('change-plan-confirming')).toBeInTheDocument()
    );
    // It must NOT have jumped straight to a confirmed / done state.
    expect(
      screen.queryByTestId('change-plan-confirmed')
    ).not.toBeInTheDocument();
  });
});
