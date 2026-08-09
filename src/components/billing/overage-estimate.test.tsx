/**
 * OverageEstimate tests.
 *
 * The number is the overage ACCRUED so far this cycle — not a projection. The
 * label must say so, and the raw Decimal string must be formatted in the plan
 * currency (never a hard-coded symbol). With no subscription there is no
 * currency, so the amount renders as an em dash.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { OverageEstimate } from './overage-estimate';

describe('OverageEstimate', () => {
  it('formats the accrued total in the plan currency and labels it accrued, not projected', () => {
    render(<OverageEstimate estimatedOverageTotal='12.5000' currency='USD' />);

    expect(screen.getByTestId('overage-amount')).toHaveTextContent('$12.50');
    expect(screen.getByText(/accrued so far this cycle/i)).toBeInTheDocument();
    expect(screen.queryByText(/project/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/forecast/i)).not.toBeInTheDocument();
  });

  it('renders an em dash when there is no subscription (no currency)', () => {
    render(<OverageEstimate estimatedOverageTotal='0.0000' currency={null} />);

    expect(screen.getByTestId('overage-amount')).toHaveTextContent('—');
    expect(screen.getByText(/accrued so far this cycle/i)).toBeInTheDocument();
  });
});
