/**
 * PurchaseAddOnDialog tests — the money-path invariants.
 *
 * The data hooks are mocked so the flow runs deterministically; the error
 * readers in `@/lib/utils/api-errors` run for real (that parsing is what routes
 * 400/409). The confirmation hook is mocked here to drive the UI branches; the
 * REAL confirmation predicate (a not-yet-readable add-on must never confirm) is
 * exercised in the sibling `purchase-add-on-dialog.confirmation.test.tsx`.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import type { ResourceKeyEnum, Subscription } from '@/client';

// ---- mocks -----------------------------------------------------------------

const h = vi.hoisted(() => ({
  purchaseAddOn: vi.fn(),
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

import { PurchaseAddOnDialog } from './purchase-add-on-dialog';

// ---- fixtures --------------------------------------------------------------

const PAID_SUBSCRIPTION = {
  id: 1,
  billing_state: 'active',
  billing_interval: 'monthly',
  add_ons: [],
} as unknown as Subscription;

const RETURNED_ADD_ON = {
  id: 42,
  resource_key: 'event_occurrences' as ResourceKeyEnum,
  quantity: 100,
  is_recurring: true,
  is_active: false,
  external_id: '',
  created: '2026-08-09T00:00:00Z',
};

function renderDialog(subscription: Subscription | null) {
  return render(
    <PurchaseAddOnDialog
      open
      onOpenChange={() => {}}
      resourceKey='event_occurrences'
      subscription={subscription}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.tokenizeResult = { status: 'tokenized', token: 'tok_test' };
  h.purchaseAddOn.mockResolvedValue(RETURNED_ADD_ON);
  h.start.mockResolvedValue({ status: 'confirmed' });
  h.refetch.mockResolvedValue({ data: PAID_SUBSCRIPTION });
});

describe('PurchaseAddOnDialog', () => {
  it('pre-selects the resource passed in and fixes it (no picker)', () => {
    renderDialog(null);

    expect(screen.getByTestId('add-on-resource-fixed')).toHaveTextContent(
      'Event occurrences'
    );
    expect(
      screen.queryByTestId('add-on-resource-select')
    ).not.toBeInTheDocument();
  });

  it('sends the resource, quantity, recurring flag, token and idempotency key', async () => {
    renderDialog(null);

    // A free org has no instrument on file → the card field shows up-front.
    expect(screen.getByTestId('mock-payment-field')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('add-on-quantity'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByTestId('add-on-recurring'));

    fireEvent.click(screen.getByTestId('purchase-add-on-submit'));

    await waitFor(() => expect(h.purchaseAddOn).toHaveBeenCalledTimes(1));
    const body = h.purchaseAddOn.mock.calls[0][0];
    expect(body).toMatchObject({
      resource_key: 'event_occurrences',
      quantity: 5,
      is_recurring: true,
      payment_token: 'tok_test',
    });
    expect(body.idempotency_key).toBeTruthy();
  });

  it('shows the pending confirmation state after a successful initiate', async () => {
    // A confirmation that never resolves during the test → the pending UI stays.
    h.start.mockReturnValue(new Promise(() => {}));

    renderDialog(null);
    fireEvent.click(screen.getByTestId('purchase-add-on-submit'));

    await waitFor(() =>
      expect(
        screen.getByTestId('purchase-add-on-confirming')
      ).toBeInTheDocument()
    );
    // It must NOT have jumped straight to a confirmed / done state.
    expect(
      screen.queryByTestId('purchase-add-on-confirmed')
    ).not.toBeInTheDocument();
  });

  it('shows the confirmed state once the add-on activates', async () => {
    h.start.mockResolvedValue({ status: 'confirmed' });

    renderDialog(null);
    fireEvent.click(screen.getByTestId('purchase-add-on-submit'));

    await waitFor(() =>
      expect(
        screen.getByTestId('purchase-add-on-confirmed')
      ).toBeInTheDocument()
    );
  });

  it('shows the still-processing state and re-polls on "Check again"', async () => {
    // The ~60s window elapses without the webhook landing → still_processing.
    h.start.mockResolvedValue({ status: 'still_processing' });

    renderDialog(null);
    fireEvent.click(screen.getByTestId('purchase-add-on-submit'));

    await waitFor(() =>
      expect(
        screen.getByTestId('purchase-add-on-still-processing')
      ).toBeInTheDocument()
    );
    expect(h.start).toHaveBeenCalledTimes(1);

    // "Check again" re-polls: a SECOND start() call.
    fireEvent.click(screen.getByText('Check again'));
    await waitFor(() => expect(h.start).toHaveBeenCalledTimes(2));
  });

  it('renders the provider-unavailable message on a 409', async () => {
    h.purchaseAddOn.mockRejectedValueOnce({
      detail: 'The payment provider is not configured.',
    });

    renderDialog(PAID_SUBSCRIPTION);
    fireEvent.click(screen.getByTestId('purchase-add-on-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('purchase-add-on-error')).toHaveTextContent(
        /provider is not configured/i
      )
    );
    // Never advanced to a pending/confirmed state on an error.
    expect(
      screen.queryByTestId('purchase-add-on-confirming')
    ).not.toBeInTheDocument();
  });

  it('renders a clear message on a 400 AddOnNotPurchasableError', async () => {
    h.purchaseAddOn.mockRejectedValueOnce({
      detail: 'This resource is not purchasable as an add-on.',
    });

    renderDialog(PAID_SUBSCRIPTION);
    fireEvent.click(screen.getByTestId('purchase-add-on-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('purchase-add-on-error')).toHaveTextContent(
        /can't be purchased as an add-on/i
      )
    );
  });

  it('reuses the SAME idempotency key across a retried submit', async () => {
    // First initiate rejects (defensively) as token-required → reveals the card
    // field; the retry succeeds. The key must be identical across both.
    h.purchaseAddOn
      .mockRejectedValueOnce({ detail: 'A payment token is required.' })
      .mockResolvedValueOnce(RETURNED_ADD_ON);

    // A paying org → no card field up-front, so the first submit exercises the
    // token-required backstop.
    renderDialog(PAID_SUBSCRIPTION);

    fireEvent.click(screen.getByTestId('purchase-add-on-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('mock-payment-field')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('purchase-add-on-submit'));
    await waitFor(() => expect(h.purchaseAddOn).toHaveBeenCalledTimes(2));

    const firstKey = h.purchaseAddOn.mock.calls[0][0].idempotency_key;
    const secondKey = h.purchaseAddOn.mock.calls[1][0].idempotency_key;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });
});
