import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { EffectiveLimitUsage } from '@/client';
import { ResourceUsageList } from './resource-usage-list';

const LIMITS: EffectiveLimitUsage[] = [
  {
    resource_key: 'organization_members',
    kind: 'prepaid',
    limit_value: 10,
    current_usage: 7,
    overage_unit_price: null,
    included_in_plan: 8,
    add_on_quantity: 2,
    by_organization: [],
  },
  {
    resource_key: 'event_occurrences',
    kind: 'postpaid',
    limit_value: 500,
    current_usage: 512,
    overage_unit_price: '0.2500',
    included_in_plan: 500,
    add_on_quantity: 0,
    by_organization: [
      { organization_id: 1, name: 'Reseller Root', usage: 400 },
      { organization_id: 2, name: 'Child Agency', usage: 112 },
    ],
  },
  {
    resource_key: 'calendar_groups',
    kind: null,
    limit_value: null,
    current_usage: 3,
    overage_unit_price: null,
    included_in_plan: null,
    add_on_quantity: 0,
    by_organization: [],
  },
];

const meta = {
  title: 'Components/Billing/ResourceUsageList',
  component: ResourceUsageList,
  tags: ['autodocs'],
  args: { limits: LIMITS, currency: 'USD' },
} satisfies Meta<typeof ResourceUsageList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = {};

export const Empty: Story = {
  args: { limits: [], currency: null },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile' } },
};
