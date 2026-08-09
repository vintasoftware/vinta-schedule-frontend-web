import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { EffectiveLimitUsage } from '@/client';
import { ResourceUsageRow } from './resource-usage-row';

const BASE: EffectiveLimitUsage = {
  resource_key: 'organization_members',
  kind: 'prepaid',
  limit_value: 10,
  current_usage: 4,
  overage_unit_price: null,
  included_in_plan: 8,
  add_on_quantity: 2,
  by_organization: [],
};

const meta = {
  title: 'Components/Billing/ResourceUsageRow',
  component: ResourceUsageRow,
  tags: ['autodocs'],
  args: { limit: BASE, currency: 'USD' },
} satisfies Meta<typeof ResourceUsageRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrepaidWithAddOns: Story = {};

export const Unlimited: Story = {
  args: {
    limit: {
      ...BASE,
      resource_key: 'calendar_groups',
      limit_value: null,
      current_usage: null,
      included_in_plan: null,
      add_on_quantity: 0,
    },
  },
};

export const PostpaidOverage: Story = {
  args: {
    limit: {
      ...BASE,
      resource_key: 'event_occurrences',
      kind: 'postpaid',
      overage_unit_price: '0.5000',
      current_usage: 118,
      limit_value: 100,
    },
  },
};

export const PooledReseller: Story = {
  args: {
    limit: {
      ...BASE,
      resource_key: 'event_occurrences',
      by_organization: [
        { organization_id: 1, name: 'Reseller Root', usage: 3 },
        { organization_id: 2, name: 'Child Agency', usage: 1 },
      ],
    },
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile' } },
};
