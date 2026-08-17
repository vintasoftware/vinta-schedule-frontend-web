import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import type { Subscription } from '@/client';
import { billingSubscriptionRetrieveSubscriptionRetrieveOptions } from '@/client/@tanstack/react-query.gen';

import { AppBillingBanner } from './app-billing-banner';

function SeededBanner({ subscription }: { subscription: Subscription | null }) {
  const [client] = useState(() => {
    const c = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    if (subscription) {
      c.setQueryData(
        billingSubscriptionRetrieveSubscriptionRetrieveOptions().queryKey,
        subscription
      );
    }
    return c;
  });
  return (
    <QueryClientProvider client={client}>
      <AppBillingBanner />
    </QueryClientProvider>
  );
}

const GRACE_SUBSCRIPTION = {
  id: 1,
  billing_state: 'grace',
  grace_period_ends_at: '2026-09-01T00:00:00Z',
  add_ons: [],
} as unknown as Subscription;

const RESTRICTED_SUBSCRIPTION = {
  id: 1,
  billing_state: 'restricted',
  grace_period_ends_at: null,
  add_ons: [],
} as unknown as Subscription;

const CANCELLED_SUBSCRIPTION = {
  id: 1,
  billing_state: 'cancelled',
  grace_period_ends_at: null,
  add_ons: [],
} as unknown as Subscription;

const meta = {
  title: 'Components/Billing/AppBillingBanner',
  component: AppBillingBanner,
  tags: ['autodocs'],
} satisfies Meta<typeof AppBillingBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grace: Story = {
  render: () => <SeededBanner subscription={GRACE_SUBSCRIPTION} />,
};

export const Restricted: Story = {
  render: () => <SeededBanner subscription={RESTRICTED_SUBSCRIPTION} />,
};

export const Cancelled: Story = {
  render: () => <SeededBanner subscription={CANCELLED_SUBSCRIPTION} />,
};

export const Hidden: Story = {
  render: () => <SeededBanner subscription={null} />,
};
