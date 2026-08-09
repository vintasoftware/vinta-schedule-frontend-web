/**
 * PeriodStatementList tests — the presentational list of statement link-rows,
 * its newest-first ordering (as the API returns it), and the empty-history vs
 * empty-filtered states.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import type { BillingPeriodSummary } from '@/client';
import { PeriodStatementList } from './period-statement-list';

function statement(
  overrides: Partial<BillingPeriodSummary> = {}
): BillingPeriodSummary {
  return {
    id: 1,
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
    ...overrides,
  };
}

describe('PeriodStatementList', () => {
  it('renders a link per statement, in the order given (newest-first)', () => {
    render(
      <PeriodStatementList
        periods={[
          statement({ id: 3, billing_period_start: '2026-08-01T00:00:00Z' }),
          statement({ id: 2, billing_period_start: '2026-07-01T00:00:00Z' }),
          statement({ id: 1, billing_period_start: '2026-06-01T00:00:00Z' }),
        ]}
      />
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute('href', '/billing/periods/3');
    expect(links[1]).toHaveAttribute('href', '/billing/periods/2');
    expect(links[2]).toHaveAttribute('href', '/billing/periods/1');
  });

  it('shows the overage total and charged state per row', () => {
    render(
      <PeriodStatementList
        periods={[
          statement({ id: 1, overage_total: '12.5000', charged: true }),
          statement({
            id: 2,
            billing_period_start: '2026-07-01T00:00:00Z',
            overage_total: '0.0000',
            charged: false,
            payment_id: null,
          }),
        ]}
      />
    );

    const charged = screen.getByTestId('period-statement-link-1');
    expect(
      within(charged).getByTestId('statement-row-overage')
    ).toHaveTextContent('$12.50');
    expect(
      within(charged).getByTestId('statement-row-charged')
    ).toBeInTheDocument();

    const uncharged = screen.getByTestId('period-statement-link-2');
    expect(
      within(uncharged).getByTestId('statement-row-not-charged')
    ).toBeInTheDocument();
  });

  it('renders the empty-history state (not an error) when there are no statements', () => {
    render(<PeriodStatementList periods={[]} />);

    expect(screen.getByTestId('period-statement-empty')).toHaveTextContent(
      'No closed statements yet'
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a distinct empty state when filters exclude everything', () => {
    render(<PeriodStatementList periods={[]} isFiltered />);

    expect(screen.getByTestId('period-statement-empty')).toHaveTextContent(
      'No statements match these filters'
    );
  });
});
