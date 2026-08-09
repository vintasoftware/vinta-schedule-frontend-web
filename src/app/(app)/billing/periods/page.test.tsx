/**
 * BillingPeriodsPage (Phase 7) tests.
 *
 * The page is the client island for `/billing/periods`: it owns the filter +
 * pagination state and reads `useBillingPeriods(filters)`. That hook is mocked
 * so the test drives the behaviors that matter:
 *
 *   • the list renders in the order the API returns (newest-first);
 *   • the date and charged filters narrow the query handed to the hook;
 *   • an empty history renders the "no closed statements yet" empty state — NOT
 *     an error (closed-period history is forward-only).
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BillingPeriodSummary } from '@/client';

// Radix Select relies on pointer-capture + scrollIntoView, absent in jsdom.
beforeAll(() => {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
});

vi.mock('@/hooks/billing/use-billing-periods', () => ({
  useBillingPeriods: vi.fn(),
}));

import { useBillingPeriods } from '@/hooks/billing/use-billing-periods';
import BillingPeriodsPage from './page';

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

function mockPeriods(periods: BillingPeriodSummary[]) {
  vi.mocked(useBillingPeriods).mockReturnValue({
    periods,
    totalCount: periods.length,
    isLoading: false,
    isError: false,
    error: null,
    periodsQuery: {} as ReturnType<typeof useBillingPeriods>['periodsQuery'],
  });
}

/** The `filters.query` object handed to the hook on its most recent render. */
function lastFilters() {
  const calls = vi.mocked(useBillingPeriods).mock.calls;
  return calls[calls.length - 1][0]?.filters;
}

describe('BillingPeriodsPage (Phase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders statements in the order returned (newest-first)', () => {
    mockPeriods([
      statement({ id: 3, billing_period_start: '2026-08-01T00:00:00Z' }),
      statement({ id: 2, billing_period_start: '2026-07-01T00:00:00Z' }),
      statement({ id: 1, billing_period_start: '2026-06-01T00:00:00Z' }),
    ]);

    render(<BillingPeriodsPage />);

    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/billing/periods/3',
      '/billing/periods/2',
      '/billing/periods/1',
    ]);
  });

  it('narrows the query with the start-date filter and resets to the first page', () => {
    mockPeriods([statement()]);

    render(<BillingPeriodsPage />);

    const from = screen.getByTestId('filter-start-after');
    fireEvent.change(from, { target: { value: '2026-01-01' } });

    expect(lastFilters()).toMatchObject({
      billing_period_start_after: '2026-01-01',
      offset: 0,
    });
  });

  it('narrows the query with the charged filter', async () => {
    mockPeriods([statement()]);

    const user = userEvent.setup();
    render(<BillingPeriodsPage />);

    await user.click(screen.getByTestId('filter-charged'));
    await user.click(screen.getByRole('option', { name: 'Charged' }));

    await waitFor(() => {
      expect(lastFilters()).toMatchObject({ charged: true });
    });
  });

  it('renders the empty-history state (not an error) for an org with no closed periods', () => {
    mockPeriods([]);

    render(<BillingPeriodsPage />);

    expect(screen.getByTestId('period-statement-empty')).toHaveTextContent(
      'No closed statements yet'
    );
    expect(
      screen.queryByTestId('statements-load-error')
    ).not.toBeInTheDocument();
  });
});
