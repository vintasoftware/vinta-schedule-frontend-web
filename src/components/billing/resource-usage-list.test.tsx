/**
 * ResourceUsageList tests — one row per limit, plus the empty state.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { EffectiveLimitUsage } from '@/client';
import { ResourceUsageList } from './resource-usage-list';

function makeLimit(
  resource_key: EffectiveLimitUsage['resource_key'],
  limit_value: number | null
): EffectiveLimitUsage {
  return {
    resource_key,
    kind: 'prepaid',
    limit_value,
    current_usage: 1,
    overage_unit_price: null,
    included_in_plan: limit_value,
    add_on_quantity: 0,
    by_organization: [],
  };
}

describe('ResourceUsageList', () => {
  it('renders a row per limit', () => {
    render(
      <ResourceUsageList
        limits={[
          makeLimit('organization_members', 10),
          makeLimit('calendar_groups', null),
        ]}
        currency='USD'
      />
    );

    expect(screen.getAllByTestId('resource-usage-row')).toHaveLength(2);
    expect(screen.getByText('Organization members')).toBeInTheDocument();
    expect(screen.getByText('Calendar groups')).toBeInTheDocument();
  });

  it('renders an empty note when there are no limits', () => {
    render(<ResourceUsageList limits={[]} currency={null} />);

    expect(screen.getByTestId('resource-usage-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('resource-usage-row')).not.toBeInTheDocument();
  });
});
