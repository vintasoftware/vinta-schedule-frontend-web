/**
 * PlanSummaryCard tests — the plan snapshot vs the free/no-cycle fallback,
 * plus the billing interval and pending-plan-change line (Phase 2).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type {
  BillingPeriodBounds,
  BillingPlanSnapshot,
  Subscription,
} from '@/client';
import { formatPeriod } from '@/lib/billing/format';
import { PlanSummaryCard } from './plan-summary-card';

const PLAN: BillingPlanSnapshot = {
  slug: 'team',
  name: 'Team',
  currency: 'USD',
};

const PERIOD: BillingPeriodBounds = {
  start: '2026-08-01T00:00:00Z',
  end: '2026-09-01T00:00:00Z',
};

const SUBSCRIPTION: Subscription = {
  id: 1,
  plan: {
    id: 1,
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
  },
  billing_state: 'active',
  billing_interval: 'monthly',
  payment_provider: 'stripe',
  current_period_start: '2026-08-01T00:00:00Z',
  current_period_end: '2026-09-01T00:00:00Z',
  grace_period_ends_at: null,
  pending_plan_slug: '',
  pending_billing_interval: 'monthly',
  pending_plan_effective_at: null,
  add_ons: [],
};

describe('PlanSummaryCard', () => {
  it('renders the plan name, slug, and period bounds', () => {
    render(<PlanSummaryCard plan={PLAN} billingPeriod={PERIOD} />);

    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByTestId('plan-slug')).toHaveTextContent('team');
    expect(screen.getByTestId('billing-period')).toBeInTheDocument();
  });

  it('renders a free / no-billing-cycle state when plan is null', () => {
    render(<PlanSummaryCard plan={null} billingPeriod={null} />);

    expect(screen.getByText('Free plan')).toBeInTheDocument();
    expect(screen.getByText(/no billing cycle/i)).toBeInTheDocument();
    expect(screen.queryByTestId('billing-period')).not.toBeInTheDocument();
  });

  it('renders the billing interval label', () => {
    render(
      <PlanSummaryCard
        plan={PLAN}
        billingPeriod={PERIOD}
        subscription={SUBSCRIPTION}
      />
    );

    expect(screen.getByTestId('billing-interval')).toHaveTextContent(
      'Monthly billing'
    );
  });

  it('does not render a pending-change line when no change is pending', () => {
    render(
      <PlanSummaryCard
        plan={PLAN}
        billingPeriod={PERIOD}
        subscription={SUBSCRIPTION}
      />
    );

    expect(screen.queryByTestId('pending-plan-change')).not.toBeInTheDocument();
  });

  it('renders the pending-change line only when pending_plan_slug is set', () => {
    render(
      <PlanSummaryCard
        plan={PLAN}
        billingPeriod={PERIOD}
        subscription={{
          ...SUBSCRIPTION,
          pending_plan_slug: 'enterprise',
          pending_plan_effective_at: '2026-09-01T00:00:00Z',
        }}
      />
    );

    const pendingLine = screen.getByTestId('pending-plan-change');
    expect(pendingLine).toHaveTextContent('Plan changes to enterprise');
    expect(pendingLine).toHaveTextContent(formatPeriod('2026-09-01T00:00:00Z'));
  });

  it('renders pending-change line without date when pending_plan_effective_at is null', () => {
    render(
      <PlanSummaryCard
        plan={PLAN}
        billingPeriod={PERIOD}
        subscription={{
          ...SUBSCRIPTION,
          pending_plan_slug: 'enterprise',
          pending_plan_effective_at: null,
        }}
      />
    );

    const pendingLine = screen.getByTestId('pending-plan-change');
    expect(pendingLine).toHaveTextContent('Plan changes to enterprise');
    expect(pendingLine.textContent).not.toContain('on');
  });

  it('omits the interval and pending-change lines when subscription is null', () => {
    render(
      <PlanSummaryCard plan={PLAN} billingPeriod={PERIOD} subscription={null} />
    );

    expect(screen.queryByTestId('billing-interval')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pending-plan-change')).not.toBeInTheDocument();
  });
});
