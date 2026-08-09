import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { OverageEstimate } from './overage-estimate';

const meta = {
  title: 'Components/Billing/OverageEstimate',
  component: OverageEstimate,
  tags: ['autodocs'],
  args: { estimatedOverageTotal: '12.5000', currency: 'USD' },
} satisfies Meta<typeof OverageEstimate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Accrued: Story = {};

export const Zero: Story = {
  args: { estimatedOverageTotal: '0.0000', currency: 'USD' },
};

export const NoSubscription: Story = {
  name: 'No subscription (no currency)',
  args: { estimatedOverageTotal: '0.0000', currency: null },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile' } },
};
