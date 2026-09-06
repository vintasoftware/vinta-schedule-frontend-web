/**
 * BillingPage (Phase 2) tests.
 *
 * The page is a Server Component rendering the `BillingOverview` client island,
 * which reads `useBillingUsage` / `useSubscription`. Those hooks are mocked so
 * the test drives the two shapes that matter:
 *
 *   • a pooled reseller fixture — the by-organization attribution surfaces the
 *     contributing children;
 *   • a free / subscription-less fixture — unlimited rows and a "0.0000" overage
 *     render cleanly (no plan, no period, no currency) without throwing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { Subscription, UsageResponse } from '@/client';

vi.mock('@/hooks/billing/use-billing-usage', () => ({
  useBillingUsage: vi.fn(),
}));
vi.mock('@/hooks/billing/use-subscription', () => ({
  useSubscription: vi.fn(),
}));

import { useBillingUsage } from '@/hooks/billing/use-billing-usage';
import { useSubscription } from '@/hooks/billing/use-subscription';
import BillingPage from './page';

function mockUsage(usage: UsageResponse | null, isError = false) {
  vi.mocked(useBillingUsage).mockReturnValue({
    usage,
    isLoading: false,
    isError,
    error: null,
    usageQuery: {} as ReturnType<typeof useBillingUsage>['usageQuery'],
  });
}

function mockSubscription(subscription: Subscription | null) {
  vi.mocked(useSubscription).mockReturnValue({
    subscription,
    isLoading: false,
    isError: subscription === null,
    error: null,
    subscriptionQuery: {} as ReturnType<
      typeof useSubscription
    >['subscriptionQuery'],
  });
}

const POOLED_USAGE: UsageResponse = {
  billing_state: 'active',
  billing_root_organization_id: 1,
  plan: { slug: 'reseller', name: 'Reseller', currency: 'USD' },
  billing_period: {
    start: '2026-08-01T00:00:00Z',
    end: '2026-09-01T00:00:00Z',
  },
  estimated_overage_total: '4.0000',
  limits: [
    {
      resource_key: 'event_occurrences',
      kind: 'postpaid',
      limit_value: 100,
      current_usage: 12,
      overage_unit_price: '0.5000',
      included_in_plan: 100,
      add_on_quantity: 0,
      by_organization: [
        { organization_id: 1, name: 'Reseller Root', usage: 9 },
        { organization_id: 2, name: 'Child Agency', usage: 3 },
      ],
    },
  ],
};

const FREE_USAGE: UsageResponse = {
  billing_state: 'free',
  billing_root_organization_id: 1,
  plan: null,
  billing_period: null,
  estimated_overage_total: '0.0000',
  limits: [
    {
      resource_key: 'organization_members',
      kind: null,
      limit_value: null,
      current_usage: 3,
      overage_unit_price: null,
      included_in_plan: null,
      add_on_quantity: 0,
      by_organization: [],
    },
    {
      resource_key: 'appointment_types',
      kind: null,
      limit_value: null,
      current_usage: 1,
      overage_unit_price: null,
      included_in_plan: null,
      add_on_quantity: 0,
      by_organization: [],
    },
  ],
};

describe('BillingPage (Phase 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Billing header', () => {
    mockUsage(FREE_USAGE);
    mockSubscription(null);

    render(<BillingPage />);
    expect(screen.getByText('Billing')).toBeInTheDocument();
  });

  it('attributes pooled usage to the contributing child organizations', () => {
    mockUsage(POOLED_USAGE);
    mockSubscription({
      grace_period_ends_at: null,
    } as unknown as Subscription);

    render(<BillingPage />);

    expect(screen.getByTestId('usage-by-organization')).toBeInTheDocument();
    expect(screen.getByText('Reseller Root')).toBeInTheDocument();
    expect(screen.getByText('Child Agency')).toBeInTheDocument();
    // The plan currency drives money formatting on the postpaid row.
    expect(screen.getByTestId('resource-overage-price')).toHaveTextContent(
      '$0.50'
    );
    expect(screen.getByTestId('overage-amount')).toHaveTextContent('$4.00');
  });

  it('renders the free / subscription-less path with unlimited rows and no overage money', () => {
    mockUsage(FREE_USAGE);
    mockSubscription(null);

    expect(() => render(<BillingPage />)).not.toThrow();

    // Free-plan card, unlimited rows, and an em-dash overage (no currency).
    // The billing-state banner itself no longer mounts here — it moved
    // app-wide to AppLayoutClient (Phase 3, billing-hardening-gap-closure;
    // see app-billing-banner.test.tsx and (app)/layout.test.tsx).
    expect(screen.getByText('Free plan')).toBeInTheDocument();
    expect(screen.getAllByTestId('resource-unlimited')).toHaveLength(2);
    expect(screen.getByTestId('overage-amount')).toHaveTextContent('—');
  });

  it('renders a friendly access-denied state when the usage read errors (403 / no active org)', () => {
    mockUsage(null, true);
    mockSubscription(null);

    render(<BillingPage />);
    expect(screen.getByTestId('billing-access-denied')).toBeInTheDocument();
  });
});
