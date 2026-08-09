import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PlanSummaryCard } from './plan-summary-card';

const meta = {
  title: 'Components/Billing/PlanSummaryCard',
  component: PlanSummaryCard,
  tags: ['autodocs'],
  args: {
    plan: { slug: 'team', name: 'Team', currency: 'USD' },
    billingPeriod: {
      start: '2026-08-01T00:00:00Z',
      end: '2026-09-01T00:00:00Z',
    },
  },
} satisfies Meta<typeof PlanSummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Paid: Story = {};

export const Free: Story = {
  args: { plan: null, billingPeriod: null },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile' } },
};
