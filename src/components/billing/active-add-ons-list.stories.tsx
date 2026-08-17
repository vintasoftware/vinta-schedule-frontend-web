import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import type { Subscription } from '@/client';
import { billingSubscriptionRetrieveSubscriptionRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import { PermissionProvider } from '@/components/navigation/permission-gate';

import { ActiveAddOnsList } from './active-add-ons-list';

const SUBSCRIPTION = {
  id: 1,
  billing_state: 'active',
  billing_interval: 'monthly',
  add_ons: [
    {
      id: 1,
      resource_key: 'event_occurrences',
      quantity: 500,
      is_recurring: true,
      is_active: true,
      external_id: 'ext_1',
      created: '2026-08-01T00:00:00Z',
    },
    {
      id: 2,
      resource_key: 'resource_calendars',
      quantity: 5,
      is_recurring: false,
      is_active: true,
      external_id: 'ext_2',
      created: '2026-08-02T00:00:00Z',
    },
    {
      id: 3,
      resource_key: 'availability_windows',
      quantity: 20,
      is_recurring: true,
      is_active: false,
      external_id: '',
      created: '2026-08-09T00:00:00Z',
    },
  ],
} as unknown as Subscription;

function Seeded({ role }: { role: 'admin' | 'member' }) {
  const [client] = useState(() => {
    const c = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    c.setQueryData(
      billingSubscriptionRetrieveSubscriptionRetrieveOptions().queryKey,
      SUBSCRIPTION
    );
    return c;
  });
  const permissions = role === 'admin' ? ['payments.manage_billing'] : [];
  return (
    <QueryClientProvider client={client}>
      <PermissionProvider permissions={permissions}>
        <ActiveAddOnsList />
      </PermissionProvider>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Components/Billing/ActiveAddOnsList',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Admin — recurring add-ons expose "Stop renewing"; one-time packs don't. */
export const Admin: Story = {
  render: () => <Seeded role='admin' />,
};

/** Member — the same add-ons, read-only (no manage action). */
export const Member: Story = {
  render: () => <Seeded role='member' />,
};

export const Mobile: Story = {
  render: () => <Seeded role='admin' />,
  globals: { viewport: { value: 'mobile' } },
};
