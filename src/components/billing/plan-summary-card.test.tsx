/**
 * PlanSummaryCard tests — the plan snapshot vs the free/no-cycle fallback.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { BillingPeriodBounds, BillingPlanSnapshot } from '@/client';
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
});
