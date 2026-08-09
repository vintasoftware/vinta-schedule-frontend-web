import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { UsageByOrganization } from './usage-by-organization';

const meta = {
  title: 'Components/Billing/UsageByOrganization',
  component: UsageByOrganization,
  tags: ['autodocs'],
  args: {
    resourceLabel: 'Event occurrences',
    byOrganization: [
      { organization_id: 1, name: 'Reseller Root', usage: 120 },
      { organization_id: 2, name: 'Child Agency', usage: 45 },
      { organization_id: 3, name: 'Downstream Studio', usage: 12 },
    ],
  },
} satisfies Meta<typeof UsageByOrganization>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PooledReseller: Story = {};

// A single-org pool renders nothing — the breakdown is only meaningful when
// more than one organization contributed.
export const SingleOrgHidden: Story = {
  name: 'Single-org pool (hidden)',
  args: {
    byOrganization: [{ organization_id: 1, name: 'Root', usage: 42 }],
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile' } },
};
