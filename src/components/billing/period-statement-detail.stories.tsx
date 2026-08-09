import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { BillingPeriodSummaryDetail } from '@/client';
import { PeriodStatementDetail } from './period-statement-detail';

const DETAIL: BillingPeriodSummaryDetail = {
  id: 42,
  billing_period_start: '2026-06-01T00:00:00Z',
  billing_period_end: '2026-07-01T00:00:00Z',
  plan_slug: 'team',
  plan_name: 'Team',
  billing_interval: 'monthly',
  currency: 'USD',
  overage_total: '12.5000',
  charged: true,
  payment_id: 1001,
  closed_at: '2026-07-01T02:00:00Z',
  resources: [
    {
      resource_key: 'event_occurrences',
      kind: 'postpaid',
      total: 125,
      limit_value: 100,
      overage_unit_price: '0.5000',
      by_organization: [
        { organization_id: 1, name: 'Reseller Root', usage: 100 },
        { organization_id: 2, name: 'Child Agency', usage: 25 },
      ],
    },
    {
      resource_key: 'organization_members',
      kind: 'prepaid',
      total: 0,
      limit_value: 10,
      overage_unit_price: null,
      by_organization: [],
    },
    {
      resource_key: 'calendar_groups',
      kind: 'prepaid',
      total: null,
      limit_value: null,
      overage_unit_price: null,
      by_organization: [],
    },
  ],
};

const meta = {
  title: 'Components/Billing/PeriodStatementDetail',
  component: PeriodStatementDetail,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: { period: DETAIL },
} satisfies Meta<typeof PeriodStatementDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A charged statement with a mix of recorded, zero, not-recorded, and unlimited rows. */
export const Charged: Story = {};

/** An uncharged period (no overage settled). */
export const NotCharged: Story = {
  args: {
    period: {
      ...DETAIL,
      overage_total: '0.0000',
      charged: false,
      payment_id: null,
    },
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile' } },
};
