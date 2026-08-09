import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { BillingStateBanner } from './billing-state-banner';

const meta = {
  title: 'Components/Billing/BillingStateBanner',
  component: BillingStateBanner,
  tags: ['autodocs'],
  args: {
    billingState: 'active',
    gracePeriodEndsAt: '2026-09-01T00:00:00Z',
  },
  argTypes: {
    billingState: {
      control: 'select',
      options: ['active', 'free', 'grace', 'restricted', 'cancelled'],
    },
  },
} satisfies Meta<typeof BillingStateBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = { args: { billingState: 'active' } };
export const Free: Story = { args: { billingState: 'free' } };
export const Grace: Story = { args: { billingState: 'grace' } };
export const Restricted: Story = { args: { billingState: 'restricted' } };
export const Cancelled: Story = { args: { billingState: 'cancelled' } };

export const GraceWithoutDeadline: Story = {
  name: 'Grace (no deadline)',
  args: { billingState: 'grace', gracePeriodEndsAt: null },
};

export const Mobile: Story = {
  args: { billingState: 'grace' },
  globals: { viewport: { value: 'mobile' } },
};
