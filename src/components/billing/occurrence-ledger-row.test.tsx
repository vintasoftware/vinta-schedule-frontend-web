/**
 * OccurrenceLedgerRow tests.
 *
 * The row is where the ledger's two contract subtleties are rendered, so they
 * are asserted here directly:
 *   • `event === null` (deleted event) renders "Event deleted" AND keeps its
 *     `unit_price` — the charge stands even though the event is gone;
 *   • a normal row shows the event title, calendar, and joined owners, and
 *     surfaces the series-root-title caveat.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { MeteredOccurrence } from '@/client';
import {
  OccurrenceLedgerRow,
  SERIES_ROOT_TITLE_CAVEAT,
} from './occurrence-ledger-row';

function occurrence(
  overrides: Partial<MeteredOccurrence> = {}
): MeteredOccurrence {
  return {
    id: 1,
    organization: { id: 10, name: 'Acme Inc.' },
    event: {
      id: 100,
      title: 'Weekly sync',
      calendar: { id: 5, name: 'Team calendar' },
      owners: [
        { user_id: 1, name: 'Ada Lovelace' },
        { user_id: 2, name: 'Alan Turing' },
      ],
    },
    occurrence_start: '2026-08-03T14:00:00Z',
    billing_period_start: '2026-08-01T00:00:00Z',
    is_within_allowance: false,
    unit_price: '0.5000',
    ...overrides,
  };
}

// A <tr> is only valid inside a table — wrap so the DOM (and RTL queries) are
// well-formed.
function renderRow(props: {
  occurrence: MeteredOccurrence;
  currency: string | null;
}) {
  return render(
    <table>
      <tbody>
        <OccurrenceLedgerRow {...props} />
      </tbody>
    </table>
  );
}

describe('OccurrenceLedgerRow', () => {
  it('renders "Event deleted" and KEEPS the unit price for a null-event row', () => {
    renderRow({
      occurrence: occurrence({ event: null, unit_price: '0.7500' }),
      currency: 'USD',
    });

    // The deleted event is an expected state, not a hidden/crashed row.
    expect(screen.getByTestId('occurrence-row-event')).toHaveTextContent(
      'Event deleted'
    );
    // The charge still stands: the price is intact and formatted.
    expect(screen.getByTestId('occurrence-row-price')).toHaveTextContent(
      '$0.75'
    );
    // No caveat affordance when there is no title to caveat.
    expect(
      screen.queryByLabelText(SERIES_ROOT_TITLE_CAVEAT)
    ).not.toBeInTheDocument();
  });

  it('shows the title, calendar, and joined owners for a normal row', () => {
    renderRow({ occurrence: occurrence(), currency: 'USD' });

    expect(screen.getByTestId('occurrence-row-event')).toHaveTextContent(
      'Weekly sync'
    );
    expect(screen.getByTestId('occurrence-row-calendar')).toHaveTextContent(
      'Team calendar'
    );
    expect(screen.getByTestId('occurrence-row-owners')).toHaveTextContent(
      'Ada Lovelace, Alan Turing'
    );
    expect(screen.getByTestId('occurrence-row-organization')).toHaveTextContent(
      'Acme Inc.'
    );
  });

  it('surfaces the series-root-title caveat on a titled row', () => {
    renderRow({ occurrence: occurrence(), currency: 'USD' });

    expect(screen.getByLabelText(SERIES_ROOT_TITLE_CAVEAT)).toBeInTheDocument();
  });

  it('renders the raw decimal when no currency is available', () => {
    renderRow({
      occurrence: occurrence({ unit_price: '0.5000' }),
      currency: null,
    });

    expect(screen.getByTestId('occurrence-row-price')).toHaveTextContent(
      '0.5000'
    );
  });

  it('renders the allowance side as Overage vs Included', () => {
    const { rerender } = renderRow({
      occurrence: occurrence({ is_within_allowance: false }),
      currency: 'USD',
    });
    expect(screen.getByTestId('occurrence-row-allowance')).toHaveTextContent(
      'Overage'
    );

    rerender(
      <table>
        <tbody>
          <OccurrenceLedgerRow
            occurrence={occurrence({ is_within_allowance: true })}
            currency='USD'
          />
        </tbody>
      </table>
    );
    expect(screen.getByTestId('occurrence-row-allowance')).toHaveTextContent(
      'Included'
    );
  });
});
