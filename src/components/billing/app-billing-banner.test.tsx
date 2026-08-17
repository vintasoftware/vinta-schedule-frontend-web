/**
 * AppBillingBanner — the app-wide gate on top of the presentational
 * `BillingStateBanner` (Phase 3, billing-hardening-gap-closure).
 *
 * `BillingStateBanner` renders something for every state (including a
 * success alert for `active`), so this wrapper is the one place that decides
 * WHETHER the org-wide shell shows it: only `grace`/`restricted` (the
 * "attention" states) render; `free`/`active`/`cancelled` and a null/loading
 * subscription stay silent.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { Subscription } from '@/client';

vi.mock('@/hooks/billing/use-subscription', () => ({
  useSubscription: vi.fn(),
}));

import { useSubscription } from '@/hooks/billing/use-subscription';
import { AppBillingBanner } from './app-billing-banner';

function mockSubscription(subscription: Subscription | null) {
  vi.mocked(useSubscription).mockReturnValue({
    subscription,
    isLoading: false,
    isError: false,
    error: null,
    subscriptionQuery: {} as ReturnType<
      typeof useSubscription
    >['subscriptionQuery'],
  });
}

function subscriptionWith(overrides: Partial<Subscription>): Subscription {
  return {
    id: 1,
    billing_state: 'active',
    grace_period_ends_at: null,
    add_ons: [],
    ...overrides,
  } as unknown as Subscription;
}

describe('AppBillingBanner', () => {
  it('renders nothing when the subscription is null (free / no-sub org)', () => {
    mockSubscription(null);
    render(<AppBillingBanner />);

    expect(
      screen.queryByTestId('billing-state-banner')
    ).not.toBeInTheDocument();
  });

  it('renders nothing for `free`', () => {
    mockSubscription(subscriptionWith({ billing_state: 'free' }));
    render(<AppBillingBanner />);

    expect(
      screen.queryByTestId('billing-state-banner')
    ).not.toBeInTheDocument();
  });

  it('renders nothing for `active`', () => {
    mockSubscription(subscriptionWith({ billing_state: 'active' }));
    render(<AppBillingBanner />);

    expect(
      screen.queryByTestId('billing-state-banner')
    ).not.toBeInTheDocument();
  });

  it('renders the banner for `cancelled`', () => {
    mockSubscription(subscriptionWith({ billing_state: 'cancelled' }));
    render(<AppBillingBanner />);

    expect(screen.getByTestId('billing-state-banner')).toBeInTheDocument();
    expect(screen.getByText(/Billing status: Cancelled/)).toBeInTheDocument();
  });

  it('renders the informational banner for `grace`, including the grace deadline', () => {
    mockSubscription(
      subscriptionWith({
        billing_state: 'grace',
        grace_period_ends_at: '2026-09-01T00:00:00Z',
      })
    );
    render(<AppBillingBanner />);

    expect(screen.getByTestId('billing-state-banner')).toBeInTheDocument();
    expect(
      screen.getByText(/Billing status: Grace period/)
    ).toBeInTheDocument();
    expect(screen.getByTestId('grace-deadline')).toBeInTheDocument();
  });

  it('renders the prominent banner for `restricted`', () => {
    mockSubscription(
      subscriptionWith({
        billing_state: 'restricted',
        grace_period_ends_at: '2026-09-01T00:00:00Z',
      })
    );
    render(<AppBillingBanner />);

    expect(screen.getByTestId('billing-state-banner')).toBeInTheDocument();
    expect(screen.getByText(/Billing status: Restricted/)).toBeInTheDocument();
  });
});
