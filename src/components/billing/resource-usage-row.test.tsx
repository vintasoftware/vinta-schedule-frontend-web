/**
 * ResourceUsageRow tests.
 *
 * Covers the plan-vs-add-on split, the "Unlimited" case (no bar, no count),
 * the postpaid overage price formatted in the plan currency, and that the
 * reseller by-organization breakdown appears only for a pool with >1 org.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { EffectiveLimitUsage } from '@/client';
import { ResourceUsageRow } from './resource-usage-row';

function makeLimit(
  overrides: Partial<EffectiveLimitUsage> = {}
): EffectiveLimitUsage {
  return {
    resource_key: 'organization_members',
    kind: 'prepaid',
    limit_value: 10,
    current_usage: 4,
    overage_unit_price: null,
    included_in_plan: 8,
    add_on_quantity: 2,
    by_organization: [],
    ...overrides,
  };
}

describe('ResourceUsageRow', () => {
  it('renders the usage count and the plan/add-on split', () => {
    render(<ResourceUsageRow limit={makeLimit()} currency='USD' />);

    expect(screen.getByText('Organization members')).toBeInTheDocument();
    expect(screen.getByTestId('resource-usage-count')).toHaveTextContent(
      '4 / 10'
    );
    expect(screen.getByTestId('resource-split')).toHaveTextContent(
      '8 included in plan + 2 from add-ons'
    );
  });

  it('omits the add-on portion of the split when there are no add-ons', () => {
    render(
      <ResourceUsageRow
        limit={makeLimit({ included_in_plan: 10, add_on_quantity: 0 })}
        currency='USD'
      />
    );

    const split = screen.getByTestId('resource-split');
    expect(split).toHaveTextContent('10 included in plan');
    expect(split).not.toHaveTextContent('from add-ons');
  });

  it('renders "Unlimited" with no usage count and no split when limit_value is null', () => {
    render(
      <ResourceUsageRow
        limit={makeLimit({
          limit_value: null,
          current_usage: null,
          included_in_plan: null,
          add_on_quantity: 0,
        })}
        currency='USD'
      />
    );

    expect(screen.getByTestId('resource-unlimited')).toHaveTextContent(
      'Unlimited'
    );
    expect(
      screen.queryByTestId('resource-usage-count')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('resource-split')).not.toBeInTheDocument();
  });

  it('renders "Not included" with no bar and no usage count when limit_value is 0', () => {
    render(
      <ResourceUsageRow
        limit={makeLimit({
          limit_value: 0,
          current_usage: 0,
          included_in_plan: 0,
          add_on_quantity: 0,
        })}
        currency='USD'
      />
    );

    expect(screen.getByTestId('resource-not-included')).toHaveTextContent(
      'Not included'
    );
    expect(
      screen.queryByTestId('resource-usage-count')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('resource-unlimited')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('does not show "Buy more" on a not-included row even when usage is nonzero', () => {
    render(
      <ResourceUsageRow
        limit={makeLimit({
          limit_value: 0,
          current_usage: 5,
          included_in_plan: 0,
          add_on_quantity: 0,
        })}
        currency='USD'
        onBuyMore={() => {}}
      />
    );

    expect(screen.getByTestId('resource-not-included')).toHaveTextContent(
      'Not included'
    );
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('resource-buy-more')).not.toBeInTheDocument();
  });

  it('formats the postpaid overage price in the plan currency', () => {
    render(
      <ResourceUsageRow
        limit={makeLimit({
          resource_key: 'event_occurrences',
          kind: 'postpaid',
          overage_unit_price: '0.5000',
        })}
        currency='USD'
      />
    );

    expect(screen.getByTestId('resource-overage-price')).toHaveTextContent(
      '$0.50'
    );
  });

  it('does not render an overage price for a prepaid resource', () => {
    render(
      <ResourceUsageRow
        limit={makeLimit({ kind: 'prepaid', overage_unit_price: null })}
        currency='USD'
      />
    );

    expect(
      screen.queryByTestId('resource-overage-price')
    ).not.toBeInTheDocument();
  });

  it('hides the by-organization breakdown for a single-org pool', () => {
    render(
      <ResourceUsageRow
        limit={makeLimit({
          by_organization: [{ organization_id: 1, name: 'Root', usage: 4 }],
        })}
        currency='USD'
      />
    );

    expect(
      screen.queryByTestId('usage-by-organization')
    ).not.toBeInTheDocument();
  });

  it('shows the by-organization breakdown for a pool with more than one org', () => {
    render(
      <ResourceUsageRow
        limit={makeLimit({
          by_organization: [
            { organization_id: 1, name: 'Root', usage: 3 },
            { organization_id: 2, name: 'Child Co', usage: 1 },
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
