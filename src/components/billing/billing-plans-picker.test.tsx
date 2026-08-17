/**
 * BillingPlansPicker tests (Phase 2) — currency-filtered catalog + the
 * limits/entitlements each card renders.
 *
 * The catalog + subscription hooks are mocked; the change-plan / cancel
 * dialogs are mocked to lightweight markers so the test can assert the
 * picker's own wiring without the real money-path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { BillingPlan, Subscription } from '@/client';
import { PermissionProvider } from '@/components/navigation/permission-gate';

vi.mock('@/hooks/billing/use-billing-plans', () => ({
  useBillingPlans: vi.fn(),
}));
vi.mock('@/hooks/billing/use-subscription', () => ({
  useSubscription: vi.fn(),
}));
vi.mock('@/components/billing/change-plan-dialog', () => ({
  ChangePlanDialog: () => null,
}));
vi.mock('@/components/billing/cancel-subscription-dialog', () => ({
  CancelSubscriptionDialog: () => null,
}));

import { useBillingPlans } from '@/hooks/billing/use-billing-plans';
import { useSubscription } from '@/hooks/billing/use-subscription';
import { BillingPlansPicker } from './billing-plans-picker';

const TEAM: BillingPlan = {
  id: 1,
  slug: 'team',
  name: 'Team',
  is_active: true,
  is_default_for_new_organizations: false,
  monthly_price: '20.0000',
  annual_price: '200.0000',
  currency: 'EUR',
  grace_period_days: 7,
  limits: [
    {
      resource_key: 'organization_members',
      limit_value: 10,
      kind: 'prepaid',
      overage_unit_price: null,
    },
    {
      resource_key: 'event_occurrences',
      limit_value: null,
      kind: 'postpaid',
      overage_unit_price: '0.2500',
    },
  ],
  entitlements: [
    { entitlement_key: 'advanced_scheduling', is_enabled: true },
    { entitlement_key: 'partner_api', is_enabled: false },
  ],
};

const SUBSCRIPTION = {
  id: 1,
  plan: { ...TEAM, slug: 'team' },
  billing_state: 'active',
  billing_interval: 'monthly',
  pending_plan_slug: '',
} as unknown as Subscription;

function mockPlans(plans: BillingPlan[]) {
  vi.mocked(useBillingPlans).mockReturnValue({
    plans,
    totalCount: plans.length,
    isLoading: false,
    isError: false,
    error: null,
    plansQuery: {} as ReturnType<typeof useBillingPlans>['plansQuery'],
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

function renderPicker() {
  return render(
    <PermissionProvider permissions={['payments.manage_billing']}>
      <BillingPlansPicker />
    </PermissionProvider>
  );
}

describe('BillingPlansPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlans([TEAM]);
  });

  it("filters the catalog to the subscription's currency", () => {
    mockSubscription(SUBSCRIPTION);

    renderPicker();

    expect(useBillingPlans).toHaveBeenCalledWith({
      query: { currency: 'EUR' },
    });
  });

  it('requests the unfiltered catalog when there is no subscription', () => {
    mockSubscription(null);

    renderPicker();

    expect(useBillingPlans).toHaveBeenCalledWith({ query: undefined });
  });

  it("renders each plan card's limits", () => {
    mockSubscription(SUBSCRIPTION);

    renderPicker();

    const limits = screen.getByTestId('plan-limits-team');
    expect(limits).toHaveTextContent('Organization members: 10');
    expect(limits).toHaveTextContent('Event occurrences: Unlimited');
  });

  it("renders only the plan card's enabled entitlements", () => {
    mockSubscription(SUBSCRIPTION);

    renderPicker();

    const entitlements = screen.getByTestId('plan-entitlements-team');
    expect(entitlements).toHaveTextContent('Advanced scheduling');
    expect(entitlements).not.toHaveTextContent('Partner API access');
  });

  it('omits the entitlements block when the plan grants none', () => {
    mockSubscription(SUBSCRIPTION);
    mockPlans([{ ...TEAM, entitlements: [] }]);

    renderPicker();

    expect(
      screen.queryByTestId('plan-entitlements-team')
    ).not.toBeInTheDocument();
  });

  it('labels a lower-priced target plan "Downgrade"', () => {
    const BASIC: BillingPlan = {
      ...TEAM,
      slug: 'basic',
      name: 'Basic',
      monthly_price: '5.0000',
      annual_price: '50.0000',
    };
    // The org's current plan (in SUBSCRIPTION) prices at 20.0000/month.
    mockSubscription(SUBSCRIPTION);
    mockPlans([TEAM, BASIC]);

    renderPicker();

    expect(screen.getByTestId('plan-change-basic')).toHaveTextContent(
      'Downgrade'
    );
  });

  it('labels a higher-priced target plan "Upgrade"', () => {
    const ENTERPRISE: BillingPlan = {
      ...TEAM,
      slug: 'enterprise',
      name: 'Enterprise',
      monthly_price: '50.0000',
      annual_price: '500.0000',
    };
    // The org's current plan (in SUBSCRIPTION) prices at 20.0000/month.
    mockSubscription(SUBSCRIPTION);
    mockPlans([TEAM, ENTERPRISE]);

    renderPicker();

    expect(screen.getByTestId('plan-change-enterprise')).toHaveTextContent(
      'Upgrade'
    );
  });

  it('mirrors the backend by pricing the CURRENT plan at its own interval, not the toggle interval', () => {
    // The subscription is on Team, MONTHLY (20.0000). The picker's toggle is
    // switched to Annual, and the target's annual price (150.0000) is lower
    // than Team's annual price (200.0000) — a same-interval (both-annual)
    // comparison would call this a "Downgrade". But the org is only ever
    // charged for the switch relative to what it's ACTUALLY paying today
    // (Team monthly, 20.0000), so mirroring the backend calls this an
    // "Upgrade".
    const PLUS: BillingPlan = {
      ...TEAM,
      slug: 'plus',
      name: 'Plus',
      monthly_price: '30.0000',
      annual_price: '150.0000',
    };
    mockSubscription(SUBSCRIPTION); // billing_interval: 'monthly'
    mockPlans([TEAM, PLUS]);

    renderPicker();
    fireEvent.click(screen.getByTestId('interval-annual'));

    expect(screen.getByTestId('plan-change-plus')).toHaveTextContent('Upgrade');
  });
});
