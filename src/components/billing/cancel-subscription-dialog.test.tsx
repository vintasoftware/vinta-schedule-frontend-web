/**
 * CancelSubscriptionDialog tests.
 *
 * Covers: the dialog explains the period-end fallback, confirming calls the
 * cancel mutation and closes, and a 409 surfaces an inline error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import type { Subscription } from '@/client';

const h = vi.hoisted(() => ({ cancelSubscription: vi.fn() }));

vi.mock('@/hooks/billing/use-cancel-subscription', () => ({
  useCancelSubscription: () => ({
    cancelSubscription: h.cancelSubscription,
    cancelSubscriptionMutation: { isPending: false },
  }),
}));

import { CancelSubscriptionDialog } from './cancel-subscription-dialog';

const SUBSCRIPTION = {
  id: 1,
  plan: { slug: 'team', name: 'Team' },
  billing_state: 'active',
  current_period_end: '2026-09-01T00:00:00Z',
} as unknown as Subscription;

beforeEach(() => {
  vi.clearAllMocks();
  h.cancelSubscription.mockResolvedValue(SUBSCRIPTION);
});

describe('CancelSubscriptionDialog', () => {
  it('explains the period-end fallback to free', () => {
    render(
      <CancelSubscriptionDialog
        open
        onOpenChange={() => {}}
        subscription={SUBSCRIPTION}
      />
    );

    expect(
      screen.getByText(/end of your current billing period/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('cancel-period-end')).toHaveTextContent(
      /fall back to the free plan/i
    );
  });

  it('confirms → calls the cancel mutation and closes', async () => {
    const onOpenChange = vi.fn();
    render(
      <CancelSubscriptionDialog
        open
        onOpenChange={onOpenChange}
        subscription={SUBSCRIPTION}
      />
    );

    fireEvent.click(screen.getByTestId('cancel-subscription-confirm'));

    await waitFor(() => expect(h.cancelSubscription).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('surfaces a 409 as an inline error and stays open', async () => {
    h.cancelSubscription.mockRejectedValueOnce({
      detail: 'The payment provider is not configured.',
    });
    const onOpenChange = vi.fn();
    render(
      <CancelSubscriptionDialog
        open
        onOpenChange={onOpenChange}
        subscription={SUBSCRIPTION}
      />
    );

    fireEvent.click(screen.getByTestId('cancel-subscription-confirm'));

    await waitFor(() =>
      expect(screen.getByTestId('cancel-error')).toHaveTextContent(
        'The payment provider is not configured.'
      )
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
