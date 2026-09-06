import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { BillingPeriodResourceUsage } from '@/client';
import { PeriodResourceRow } from './period-resource-row';

const BASE: BillingPeriodResourceUsage = {
  resource_key: 'event_occurrences',
  kind: 'postpaid',
  total: 118,
  limit_value: 100,
  overage_unit_price: '0.5000',
  by_organization: [],
};

const meta = {
  title: 'Components/Billing/PeriodResourceRow',
  component: PeriodResourceRow,
  tags: ['autodocs'],
  args: { resource: BASE, currency: 'USD' },
} satisfies Meta<typeof PeriodResourceRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Postpaid resource with recorded usage over the limit and an overage price. */
export const PostpaidOverLimit: Story = {};

/**
 * A recorded usage of ZERO — renders as "0", which is a real value and must be
 * visibly distinct from the "Not recorded" case below.
 */
export const RecordedZero: Story = {
  args: {
    resource: {
      ...BASE,
      resource_key: 'webhook_subscriptions',
      kind: 'prepaid',
      total: 0,
      limit_value: 5,
      overage_unit_price: null,
    },
  },
};

/**
 * `total: null` — the metric was NEVER recorded for this period. Renders as
 * "Not recorded", never "0".
 */
export const NotRecorded: Story = {
  args: {
    resource: {
      ...BASE,
      resource_key: 'organization_members',
      kind: 'prepaid',
      total: null,
      limit_value: 10,
      overage_unit_price: null,
    },
  },
};

/**
 * `limit_value: null` — an UNLIMITED ceiling. A different null than total's;
 * renders as "Unlimited".
 */
export const UnlimitedLimit: Story = {
  args: {
    resource: {
      ...BASE,
      resource_key: 'appointment_types',
      kind: 'prepaid',
      total: 12,
      limit_value: null,
      overage_unit_price: null,
    },
  },
};

/** Pooled reseller — the by-organization attribution renders (>1 contributor). */
export const PooledReseller: Story = {
  args: {
    resource: {
      ...BASE,
      by_organization: [
        { organization_id: 1, name: 'Reseller Root', usage: 90 },
        { organization_id: 2, name: 'Child Agency', usage: 28 },
      ],
    },
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile' } },
};
