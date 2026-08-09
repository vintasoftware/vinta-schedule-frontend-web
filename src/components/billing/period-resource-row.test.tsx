/**
 * PeriodResourceRow tests.
 *
 * The load-bearing assertions cover the TWO DISTINCT NULLS the API carries and
 * that a client must never collapse:
 *   • `total: null`  → "Not recorded" (metric never captured) — NEVER "0".
 *   • `total: 0`     → "0" (a real recorded zero) — visibly distinct from above.
 *   • `limit_value: null` → "Unlimited" (a different meaning than "Not recorded").
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { BillingPeriodResourceUsage } from '@/client';
import { PeriodResourceRow } from './period-resource-row';

function makeResource(
  overrides: Partial<BillingPeriodResourceUsage> = {}
): BillingPeriodResourceUsage {
  return {
    resource_key: 'event_occurrences',
    kind: 'postpaid',
    total: 118,
    limit_value: 100,
    overage_unit_price: '0.5000',
    by_organization: [],
    ...overrides,
  };
}

describe('PeriodResourceRow', () => {
  it('renders a recorded usage of zero as "0"', () => {
    render(
      <PeriodResourceRow
        resource={makeResource({ total: 0, overage_unit_price: null })}
        currency='USD'
      />
    );

    expect(screen.getByTestId('period-resource-total')).toHaveTextContent('0');
    // A real zero must NOT read as "Not recorded".
    expect(screen.getByTestId('period-resource-total')).not.toHaveTextContent(
      'Not recorded'
    );
  });

  it('renders a null total as "Not recorded", never "0"', () => {
    render(
      <PeriodResourceRow
        resource={makeResource({ total: null, overage_unit_price: null })}
        currency='USD'
      />
    );

    const total = screen.getByTestId('period-resource-total');
    expect(total).toHaveTextContent('Not recorded');
    expect(total).not.toHaveTextContent('0');
  });

  it('renders "Not recorded" (null total) and "0" (recorded zero) as VISIBLY DISTINCT', () => {
    const { rerender } = render(
      <PeriodResourceRow
        resource={makeResource({ total: null, overage_unit_price: null })}
        currency='USD'
      />
    );
    const notRecorded = screen.getByTestId('period-resource-total').textContent;

    rerender(
      <PeriodResourceRow
        resource={makeResource({ total: 0, overage_unit_price: null })}
        currency='USD'
      />
    );
    const recordedZero = screen.getByTestId(
      'period-resource-total'
    ).textContent;

    expect(notRecorded).toBe('Not recorded');
    expect(recordedZero).toBe('0');
    expect(notRecorded).not.toBe(recordedZero);
  });

  it('renders a null limit_value as "Unlimited", distinct from a not-recorded total', () => {
    render(
      <PeriodResourceRow
        resource={makeResource({
          total: null,
          limit_value: null,
          overage_unit_price: null,
        })}
        currency='USD'
      />
    );

    // The limit null means Unlimited...
    expect(screen.getByTestId('period-resource-limit')).toHaveTextContent(
      'Unlimited'
    );
    // ...and the total null still means Not recorded — the two are not conflated.
    expect(screen.getByTestId('period-resource-total')).toHaveTextContent(
      'Not recorded'
    );
    expect(screen.getByTestId('period-resource-limit')).not.toHaveTextContent(
      'Not recorded'
    );
  });

  it('renders a numeric limit_value as its number', () => {
    render(
      <PeriodResourceRow
        resource={makeResource({ limit_value: 100 })}
        currency='USD'
      />
    );

    expect(screen.getByTestId('period-resource-limit')).toHaveTextContent(
      '100'
    );
  });

  it('formats the overage unit price in the statement currency', () => {
    render(
      <PeriodResourceRow
        resource={makeResource({ overage_unit_price: '0.5000' })}
        currency='USD'
      />
    );

    expect(
      screen.getByTestId('period-resource-overage-price')
    ).toHaveTextContent('$0.50 per unit');
  });

  it('omits the overage price when the resource has none', () => {
    render(
      <PeriodResourceRow
        resource={makeResource({ overage_unit_price: null })}
        currency='USD'
      />
    );

    expect(
      screen.queryByTestId('period-resource-overage-price')
    ).not.toBeInTheDocument();
  });

  it('reuses the by-organization breakdown, shown only for a pool with >1 org', () => {
    render(
      <PeriodResourceRow
        resource={makeResource({
          by_organization: [
            { organization_id: 1, name: 'Root', usage: 90 },
            { organization_id: 2, name: 'Child Co', usage: 28 },
          ],
        })}
        currency='USD'
      />
    );

    expect(screen.getByTestId('usage-by-organization')).toBeInTheDocument();
    expect(screen.getByText('Root')).toBeInTheDocument();
    expect(screen.getByText('Child Co')).toBeInTheDocument();
  });
});
