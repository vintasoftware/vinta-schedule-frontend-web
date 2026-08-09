/**
 * BillingStateBanner tests.
 *
 * Covers the state → presentation mapping and, critically, that the grace
 * deadline + "Resolve payment" link appear ONLY in GRACE / RESTRICTED — an
 * ACTIVE or FREE org must never see a dunning affordance.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { BillingStateBanner } from './billing-state-banner';

const DEADLINE = '2026-09-01T00:00:00Z';

describe('BillingStateBanner', () => {
  it('shows an Active label with no deadline and no resolve link', () => {
    render(<BillingStateBanner billingState='active' />);

    expect(screen.getByText(/Billing status: Active/)).toBeInTheDocument();
    expect(screen.queryByTestId('grace-deadline')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /resolve payment/i })
    ).not.toBeInTheDocument();
  });

  it('shows a Free label with no deadline and no resolve link', () => {
    render(<BillingStateBanner billingState='free' />);

    expect(screen.getByText(/Billing status: Free/)).toBeInTheDocument();
    expect(screen.queryByTestId('grace-deadline')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /resolve payment/i })
    ).not.toBeInTheDocument();
  });

  it('shows the grace deadline and a resolve-payment link in GRACE', () => {
    render(
      <BillingStateBanner billingState='grace' gracePeriodEndsAt={DEADLINE} />
    );

    expect(
      screen.getByText(/Billing status: Grace period/)
    ).toBeInTheDocument();
    expect(screen.getByTestId('grace-deadline')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /resolve payment/i });
    expect(link).toHaveAttribute('href', '/billing/resolve-payment');
  });

  it('shows the resolve-payment link in RESTRICTED', () => {
    render(
      <BillingStateBanner
        billingState='restricted'
        gracePeriodEndsAt={DEADLINE}
      />
    );

    expect(screen.getByText(/Billing status: Restricted/)).toBeInTheDocument();
    expect(screen.getByTestId('grace-deadline')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /resolve payment/i })
    ).toHaveAttribute('href', '/billing/resolve-payment');
  });

  it('still links to resolve payment in GRACE even without a deadline, but shows no deadline line', () => {
    render(
      <BillingStateBanner billingState='grace' gracePeriodEndsAt={null} />
    );

    expect(
      screen.getByRole('link', { name: /resolve payment/i })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('grace-deadline')).not.toBeInTheDocument();
  });
});
