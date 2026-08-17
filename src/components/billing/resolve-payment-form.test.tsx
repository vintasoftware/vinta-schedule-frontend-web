/**
 * ResolvePaymentForm tests — the money-path recovery invariants
 * (billing-hardening Phase 7).
 *
 * `useRetryPayment` / `useSubscription` and the card field are mocked so the
 * test drives the flow deterministically, but the async-confirmation hook is
 * left REAL: the load-bearing behavior is that recovery confirms ONLY on a
 * real subscription read back to `active`, and a still-GRACE or a
 * null/undefined read must keep polling — never render "recovered" early. The
 * `isRecoveryConfirmed` predicate is also asserted directly for those three
 * cases.
 *
 * The load-bearing behaviors:
 *   • submit sends the fresh token + a per-attempt idempotency key to
 *     retry-payment (no `plan_slug`/`billing_interval` — retry-payment doesn't
 *     take them);
 *   • a 200 response does NOT show success — it still polls to `active`;
 *   • a retried submit REUSES the same idempotency key (never double-charges);
 *   • `charge_declined` resets the idempotency key (a FRESH key on the next
 *     submit — the double-charge guard for a genuinely new card), refetches
 *     the subscription, and re-prompts on the form;
 *   • each coded 409 renders its own distinct message; `subscription_not_attached`
 *     routes to the first-payment/upgrade surface instead of re-prompting;
 *   • an `active` poll lands the confirmed state; a still-GRACE poll stays in the
 *     confirming state (does not confirm);
 *   • the grace deadline renders.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';

import type { Subscription } from '@/client';
import {
  CONFIRMATION_POLL_INTERVAL_MS,
  CONFIRMATION_TIMEOUT_MS,
} from '@/hooks/billing/use-await-payment-confirmation';

import { isRecoveryConfirmed } from './resolve-payment-form';

// ---- mocks -----------------------------------------------------------------

const h = vi.hoisted(() => ({
  retryPayment: vi.fn(),
  refetch: vi.fn(),
  tokenizeResult: { status: 'tokenized', token: 'tok_new' } as {
    status: string;
    token?: string;
    reason?: string;
    message?: string;
  },
}));

vi.mock('@/hooks/billing/use-retry-payment', () => ({
  useRetryPayment: () => ({
    retryPayment: h.retryPayment,
    retryPaymentMutation: { isPending: false },
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
  // Default initiate: retry-payment returns before the webhook (still grace).
  h.retryPayment.mockResolvedValue(GRACE_SUBSCRIPTION);
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

  it('submits the fresh token + an idempotency key to retry-payment (no plan re-affirm)', async () => {
    renderForm();

    fireEvent.click(screen.getByTestId('resolve-payment-submit'));

    await waitFor(() => expect(h.retryPayment).toHaveBeenCalledTimes(1));
    const body = h.retryPayment.mock.calls[0][0];
    expect(body).toMatchObject({
      payment_token: 'tok_new', // a FRESH instrument
    });
    expect(body.idempotency_key).toBeTruthy();
    // retry-payment doesn't take a plan — there's nothing to re-affirm.
    expect(body).not.toHaveProperty('plan_slug');
    expect(body).not.toHaveProperty('billing_interval');

    // The real confirmation hook polls; the ACTIVE read lands the confirmed UI.
    await waitFor(() =>
      expect(
        screen.getByTestId('resolve-payment-confirmed')
      ).toBeInTheDocument()
    );
    expect(h.refetch).toHaveBeenCalled();
  });

  it('a 2xx does NOT show success — it shows pending until the poll confirms ACTIVE', async () => {
    vi.useFakeTimers();
    try {
      // The immediate poll (right after initiate) is still GRACE — the
      // webhook hasn't landed yet; only the NEXT poll (after the interval)
      // lands ACTIVE. This proves the 2xx initiate response is never trusted
      // as success on its own.
      h.refetch
        .mockResolvedValueOnce({ data: GRACE_SUBSCRIPTION })
        .mockResolvedValue({ data: ACTIVE_SUBSCRIPTION });

      renderForm();
      fireEvent.click(screen.getByTestId('resolve-payment-submit'));

      // Flush tokenize + initiate + the immediate poll → pending, NOT confirmed.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(h.retryPayment).toHaveBeenCalledTimes(1);
      expect(
        screen.getByTestId('resolve-payment-confirming')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('resolve-payment-confirmed')
      ).not.toBeInTheDocument();

      // The next interval poll lands ACTIVE → confirmed.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS);
      });
      expect(
        screen.getByTestId('resolve-payment-confirmed')
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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

  it('falls back to still-processing at the ceiling, then re-confirms on "Check again"', async () => {
    vi.useFakeTimers();
    try {
      // The webhook never lands: every read stays GRACE through the ceiling.
      h.refetch.mockResolvedValue({ data: GRACE_SUBSCRIPTION });

      renderForm();
      fireEvent.click(screen.getByTestId('resolve-payment-submit'));

      // Flush tokenize + initiate + the immediate poll → confirming.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(
        screen.getByTestId('resolve-payment-confirming')
      ).toBeInTheDocument();

      // Run out the confirmation ceiling without recovery → still-processing.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(CONFIRMATION_TIMEOUT_MS);
      });
      expect(
        screen.getByTestId('resolve-payment-still-processing')
      ).toBeInTheDocument();

      const pollsBeforeCheckAgain = h.refetch.mock.calls.length;

      // "Check again" re-enters the confirming state — a SECOND poll cycle.
      fireEvent.click(screen.getByTestId('resolve-payment-check-again'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(
        screen.getByTestId('resolve-payment-confirming')
      ).toBeInTheDocument();
      expect(h.refetch.mock.calls.length).toBeGreaterThan(
        pollsBeforeCheckAgain
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('reuses the SAME idempotency key across a retried submit (double-click / same-attempt retry)', async () => {
    // First initiate fails (a transient conflict, NOT charge_declined); the
    // second succeeds. A non-decline error must NOT reset the key.
    h.retryPayment
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
    await waitFor(() => expect(h.retryPayment).toHaveBeenCalledTimes(2));

    const firstKey = h.retryPayment.mock.calls[0][0].idempotency_key;
    const secondKey = h.retryPayment.mock.calls[1][0].idempotency_key;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });

  it('charge_declined mints a FRESH idempotency key for the next attempt, refetches, and re-prompts', async () => {
    // First attempt: the charge is declined. Second attempt (a new card):
    // succeeds.
    h.retryPayment
      .mockRejectedValueOnce({ code: 'charge_declined', detail: 'declined' })
      .mockResolvedValueOnce(GRACE_SUBSCRIPTION);

    renderForm();

    const refetchCallsBefore = h.refetch.mock.calls.length;

    // First submit → declined.
    fireEvent.click(screen.getByTestId('resolve-payment-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('resolve-payment-error')).toHaveTextContent(
        'That card was declined'
      )
    );
    // The subscription is refetched so its state is current after the decline.
    expect(h.refetch.mock.calls.length).toBeGreaterThan(refetchCallsBefore);
    // Still on the form — no phase transition away from it.
    expect(screen.getByTestId('resolve-payment-form')).toBeInTheDocument();

    // Second submit (a genuinely new card) → succeeds with a DIFFERENT key.
    fireEvent.click(screen.getByTestId('resolve-payment-submit'));
    await waitFor(() => expect(h.retryPayment).toHaveBeenCalledTimes(2));

    const firstKey = h.retryPayment.mock.calls[0][0].idempotency_key;
    const secondKey = h.retryPayment.mock.calls[1][0].idempotency_key;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);
  });

  it('shows a distinct message for retry_payment_not_applicable', async () => {
    h.retryPayment.mockRejectedValueOnce({
      code: 'retry_payment_not_applicable',
      detail: 'not applicable',
    });

    renderForm();
    fireEvent.click(screen.getByTestId('resolve-payment-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('resolve-payment-error')).toHaveTextContent(
        "doesn't need a payment retry right now"
      )
    );
  });

  it('shows a distinct message for no_outstanding_balance', async () => {
    h.retryPayment.mockRejectedValueOnce({
      code: 'no_outstanding_balance',
      detail: 'nothing owed',
    });

    renderForm();
    fireEvent.click(screen.getByTestId('resolve-payment-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('resolve-payment-error')).toHaveTextContent(
        'no outstanding balance to pay'
      )
    );
  });

  it('shows a distinct message for collection_not_supported', async () => {
    h.retryPayment.mockRejectedValueOnce({
      code: 'collection_not_supported',
      detail: 'provider cannot collect',
    });

    renderForm();
    fireEvent.click(screen.getByTestId('resolve-payment-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('resolve-payment-error')).toHaveTextContent(
        "isn't available for your payment provider"
      )
    );
  });

  it('routes subscription_not_attached to the first-payment/upgrade path, not a retry prompt', async () => {
    h.retryPayment.mockRejectedValueOnce({
      code: 'subscription_not_attached',
      detail: 'never attached',
    });

    renderForm();
    fireEvent.click(screen.getByTestId('resolve-payment-submit'));

    await waitFor(() =>
      expect(
        screen.getByTestId('resolve-payment-needs-upgrade')
      ).toBeInTheDocument()
    );
    // No retry form, no generic error banner — a link to the upgrade flow.
    expect(
      screen.queryByTestId('resolve-payment-form')
    ).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: /choose a plan/i });
    expect(link).toHaveAttribute('href', '/billing/plans');
  });

  it('surfaces the over-limit message on a 402 limit_exceeded', async () => {
    h.retryPayment.mockRejectedValueOnce({
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

  it('does not call retry-payment when tokenization fails', async () => {
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
    expect(h.retryPayment).not.toHaveBeenCalled();
  });
});
