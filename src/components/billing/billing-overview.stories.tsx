import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import type { Subscription, UsageResponse } from '@/client';
import {
  billingSubscriptionRetrieveSubscriptionRetrieveOptions,
  billingUsageRetrieveUsageRetrieveOptions,
} from '@/client/@tanstack/react-query.gen';

import { BillingOverview } from './billing-overview';

const ACTIVE_USAGE: UsageResponse = {
  billing_state: 'active',
  billing_root_organization_id: 1,
  plan: { slug: 'reseller', name: 'Reseller', currency: 'USD' },
  billing_period: {
    start: '2026-08-01T00:00:00Z',
    end: '2026-09-01T00:00:00Z',
  },
  estimated_overage_total: '4.0000',
  limits: [
    {
      resource_key: 'organization_members',
      kind: 'prepaid',
      limit_value: 20,
      current_usage: 14,
      overage_unit_price: null,
      included_in_plan: 15,
      add_on_quantity: 5,
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
      resource_key: 'appointment_types',
      kind: null,
      limit_value: null,
      current_usage: 8,
      overage_unit_price: null,
      included_in_plan: null,
      add_on_quantity: 0,
      by_organization: [],
    },
  ],
};

const FREE_USAGE: UsageResponse = {
  billing_state: 'free',
  billing_root_organization_id: 1,
  plan: null,
  billing_period: null,
  estimated_overage_total: '0.0000',
  limits: [
    {
      resource_key: 'organization_members',
      kind: null,
      limit_value: null,
      current_usage: 3,
      overage_unit_price: null,
      included_in_plan: null,
      add_on_quantity: 0,
      by_organization: [],
    },
  ],
};

// A GRACE subscription supplies the deadline the banner shows.
const GRACE_SUBSCRIPTION = {
  billing_state: 'grace',
  grace_period_ends_at: '2026-09-01T00:00:00Z',
} as unknown as Subscription;

function SeededOverview({
  usage,
  subscription,
}: {
  usage: UsageResponse;
  subscription?: Subscription;
}) {
  const [client] = useState(() => {
    const c = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    c.setQueryData(billingUsageRetrieveUsageRetrieveOptions().queryKey, usage);
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
      <BillingOverview />
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Components/Billing/BillingOverview',
  component: BillingOverview,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BillingOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActivePooled: Story = {
  render: () => <SeededOverview usage={ACTIVE_USAGE} />,
};

export const GraceWithDeadline: Story = {
  render: () => (
    <SeededOverview
      usage={{ ...ACTIVE_USAGE, billing_state: 'grace' }}
      subscription={GRACE_SUBSCRIPTION}
    />
  ),
};

export const FreeOrganization: Story = {
  render: () => <SeededOverview usage={FREE_USAGE} />,
};

export const Mobile: Story = {
  render: () => <SeededOverview usage={ACTIVE_USAGE} />,
  globals: { viewport: { value: 'mobile' } },
};
