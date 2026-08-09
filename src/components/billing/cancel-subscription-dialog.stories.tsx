import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import type { Subscription } from '@/client';

import { CancelSubscriptionDialog } from './cancel-subscription-dialog';

const SUBSCRIPTION = {
  id: 1,
  plan: { slug: 'team', name: 'Team' },
  billing_state: 'active',
  current_period_end: '2026-09-01T00:00:00Z',
} as unknown as Subscription;

function SeededDialog() {
  const [open, setOpen] = useState(true);
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  );
  return (
    <QueryClientProvider client={client}>
      <CancelSubscriptionDialog
        open={open}
        onOpenChange={setOpen}
        subscription={SUBSCRIPTION}
      />
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Components/Billing/CancelSubscriptionDialog',
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Default — the period-end fallback explanation and the confirm/keep actions. */
export const Default: Story = {
  render: () => <SeededDialog />,
};

export const Mobile: Story = {
  render: () => <SeededDialog />,
  globals: { viewport: { value: 'mobile' } },
};
