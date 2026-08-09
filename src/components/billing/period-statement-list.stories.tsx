import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { BillingPeriodSummary } from '@/client';
import { PeriodStatementList } from './period-statement-list';

function statement(
  overrides: Partial<BillingPeriodSummary> = {}
): BillingPeriodSummary {
  return {
    id: 1,
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
    ...overrides,
  };
}

const meta = {
  title: 'Components/Billing/PeriodStatementList',
  component: PeriodStatementList,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof PeriodStatementList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A page of statements, newest-first as the API returns them. */
export const WithStatements: Story = {
  args: {
    periods: [
      statement({ id: 3, billing_period_start: '2026-08-01T00:00:00Z' }),
      statement({
        id: 2,
        billing_period_start: '2026-07-01T00:00:00Z',
        overage_total: '0.0000',
        charged: false,
        payment_id: null,
      }),
      statement({ id: 1, billing_period_start: '2026-06-01T00:00:00Z' }),
    ],
  },
};

/** Forward-only history: an org that has never closed a period. NOT an error. */
export const EmptyHistory: Story = {
  args: { periods: [], isFiltered: false },
};

/** An empty result caused by active filters — distinct empty-state copy. */
export const EmptyFiltered: Story = {
  args: { periods: [], isFiltered: true },
};

export const Mobile: Story = {
  args: WithStatements.args,
  globals: { viewport: { value: 'mobile' } },
};
