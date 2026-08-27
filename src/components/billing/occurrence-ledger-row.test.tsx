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
import type { CalendarLedgerEvent } from '@/lib/billing/ledger-event';
import {
  OccurrenceLedgerRow,
  SERIES_ROOT_TITLE_CAVEAT,
} from './occurrence-ledger-row';

/**
 * The event half of a ledger row, as this project's `OccurrenceSource` sends
 * it. Built through a helper typed `CalendarLedgerEvent` rather than inlined:
 * the generated `LedgerEvent` declares only `id`, so an inline literal would
 * trip excess-property checking on every project field.
 */
function ledgerEvent(
  overrides: Partial<CalendarLedgerEvent> = {}
): CalendarLedgerEvent {
  return {
    id: 100,
    title: 'Weekly sync',
    calendar: { id: 5, name: 'Team calendar' },
    owners: [
      { user_id: 1, name: 'Ada Lovelace' },
      { user_id: 2, name: 'Alan Turing' },
    ],
    ...overrides,
  };
}

function occurrence(
  overrides: Partial<MeteredOccurrence> = {}
): MeteredOccurrence {
  return {
    id: 1,
    organization: { id: 10, name: 'Acme Inc.' },
    event: ledgerEvent(),
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

  it('renders the row when the source sends only the declared id', () => {
    // Since vinta-django-billing 0.6.0 the schema guarantees only `event.id` —
    // title/calendar/owners are the project's own extras. A source that stops
    // sending them must degrade to em-dashes, not crash the row on
    // `owners.map`, and above all must not drop the charge.
    renderRow({
      occurrence: occurrence({ event: { id: 100 } }),
      currency: 'USD',
    });

    expect(screen.getByTestId('occurrence-row-event')).toHaveTextContent(
      'Untitled event'
    );
    expect(screen.getByTestId('occurrence-row-calendar')).toHaveTextContent(
      '—'
    );
    expect(screen.getByTestId('occurrence-row-owners')).toHaveTextContent('—');
    // The charge is what the ledger exists to justify — it survives intact.
    expect(screen.getByTestId('occurrence-row-price')).toHaveTextContent(
      '$0.50'
    );
  });

  it('renders "—" for a null calendar while keeping the title and caveat', () => {
    // The event is present but its calendar was cleared/deleted — the calendar
    // cell falls back to the em-dash while the title and its series-root caveat
    // still render.
    renderRow({
      occurrence: occurrence({
        event: ledgerEvent({
          calendar: null,
          owners: [{ user_id: 1, name: 'Ada Lovelace' }],
        }),
      }),
      currency: 'USD',
    });

    expect(screen.getByTestId('occurrence-row-calendar')).toHaveTextContent(
      '—'
    );
    expect(screen.getByTestId('occurrence-row-event')).toHaveTextContent(
      'Weekly sync'
    );
    expect(screen.getByLabelText(SERIES_ROOT_TITLE_CAVEAT)).toBeInTheDocument();
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
