/**
 * UsageByOrganization tests — the >1-contributor gate and the rendered split.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { UsageByOrganization as UsageByOrganizationRow } from '@/client';
import { UsageByOrganization } from './usage-by-organization';

const TWO: UsageByOrganizationRow[] = [
  { organization_id: 1, name: 'Reseller Root', usage: 7 },
  { organization_id: 2, name: 'Child Studio', usage: 3 },
];

describe('UsageByOrganization', () => {
  it('renders nothing for an empty pool', () => {
    const { container } = render(
      <UsageByOrganization byOrganization={[]} resourceLabel='Members' />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a single-org pool', () => {
    const { container } = render(
      <UsageByOrganization
        byOrganization={[{ organization_id: 1, name: 'Root', usage: 5 }]}
        resourceLabel='Members'
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders each contributing organization and its usage for a pool >1', () => {
    render(
      <UsageByOrganization byOrganization={TWO} resourceLabel='Members' />
    );

    expect(screen.getByTestId('usage-by-organization')).toBeInTheDocument();
    expect(screen.getByText('Reseller Root')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Child Studio')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
