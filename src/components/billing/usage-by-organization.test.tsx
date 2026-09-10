/**
 * UsageByOrganization tests — the >1-contributor gate and the rendered split.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { UsageByScope as UsageByScopeRow } from '@/client';
import { UsageByOrganization } from './usage-by-organization';

const TWO: UsageByScopeRow[] = [
  { scope_id: 1, name: 'Reseller Root', usage: 7 },
  { scope_id: 2, name: 'Child Studio', usage: 3 },
];

describe('UsageByOrganization', () => {
  it('renders nothing for an empty pool', () => {
    const { container } = render(
      <UsageByOrganization byScope={[]} resourceLabel='Members' />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a single-org pool', () => {
    const { container } = render(
      <UsageByOrganization
        byScope={[{ scope_id: 1, name: 'Root', usage: 5 }]}
        resourceLabel='Members'
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders each contributing organization and its usage for a pool >1', () => {
    render(<UsageByOrganization byScope={TWO} resourceLabel='Members' />);

    expect(screen.getByTestId('usage-by-organization')).toBeInTheDocument();
    expect(screen.getByText('Reseller Root')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Child Studio')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
