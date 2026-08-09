/**
 * PeriodStatementDetail tests — the header snapshot plus one row per
 * `resources[]` entry, with the two distinct nulls preserved through the
 * composition and no reconciliation data rendered (the API never serializes
 * it).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { BillingPeriodSummaryDetail } from '@/client';
import { PeriodStatementDetail } from './period-statement-detail';

const DETAIL: BillingPeriodSummaryDetail = {
  id: 42,
  billing_period_start: '2026-06-01T00:00:00Z',
  billing_period_end: '2026-07-01T00:00:00Z',
  plan_slug: 'team',
  plan_name: 'Team',
  billing_interval: 'monthly',
  currency: 'USD',
  overage_total: '12.5000',
  charged: true,
  payment_id: 1001,
  closed_at: '2026-07-01T02:00:00Z',
  resources: [
    {
      resource_key: 'event_occurrences',
      kind: 'postpaid',
      total: 125,
      limit_value: 100,
      overage_unit_price: '0.5000',
      by_organization: [],
    },
    {
      resource_key: 'organization_members',
      kind: 'prepaid',
      total: 0,
      limit_value: 10,
      overage_unit_price: null,
      by_organization: [],
    },
    {
      resource_key: 'calendar_groups',
      kind: 'prepaid',
      total: null,
      limit_value: null,
      overage_unit_price: null,
      by_organization: [],
    },
  ],
};

describe('PeriodStatementDetail', () => {
  it('renders the plan snapshot, overage total, and charged badge', () => {
    render(<PeriodStatementDetail period={DETAIL} />);

    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByTestId('statement-plan-slug')).toHaveTextContent('team');
    expect(screen.getByTestId('statement-overage-total')).toHaveTextContent(
      '$12.50'
    );
    expect(screen.getByTestId('statement-charged')).toBeInTheDocument();
    expect(
      screen.queryByTestId('statement-not-charged')
    ).not.toBeInTheDocument();
  });

  it('renders one row per resource in the breakdown', () => {
    render(<PeriodStatementDetail period={DETAIL} />);

    expect(screen.getAllByTestId('period-resource-row')).toHaveLength(3);
    expect(screen.getByText('Event occurrences')).toBeInTheDocument();
    expect(screen.getByText('Organization members')).toBeInTheDocument();
    expect(screen.getByText('Calendar groups')).toBeInTheDocument();
  });

  it('preserves the two distinct nulls through the composition', () => {
    render(<PeriodStatementDetail period={DETAIL} />);

    const totals = screen.getAllByTestId('period-resource-total');
    const limits = screen.getAllByTestId('period-resource-limit');
    // Recorded zero, and the not-recorded null, both present and distinct.
    expect(totals.map((n) => n.textContent)).toContain('0');
    expect(totals.map((n) => n.textContent)).toContain('Not recorded');
    // The unlimited limit is present and is NOT "Not recorded".
    expect(limits.map((n) => n.textContent)).toContain('Unlimited');
  });

  it('renders an uncharged period without a charged badge', () => {
    render(
      <PeriodStatementDetail
        period={{
          ...DETAIL,
          charged: false,
          payment_id: null,
          overage_total: '0.0000',
        }}
      />
    );

    expect(screen.getByTestId('statement-not-charged')).toBeInTheDocument();
    expect(screen.queryByTestId('statement-charged')).not.toBeInTheDocument();
  });
});
