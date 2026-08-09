import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import type { PaymentProvider, Subscription } from '@/client';
import { billingPaymentProviderRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import { asPaymentToken } from '@/lib/billing/payment-token';
import type { PaymentProviderSdkFactory } from '@/lib/billing/payment-provider-sdk';

import { PurchaseAddOnDialog } from './purchase-add-on-dialog';

// A fake SDK so the embedded card field never loads a real provider script.
const fakeSdk: PaymentProviderSdkFactory = () => ({
  load: async () => {},
  mountCardElement: async (container) => {
    const el = document.createElement('div');
    el.textContent = '•••• •••• •••• 4242 — mock secure card element';
    el.className = 'text-sm text-muted-foreground';
    container.appendChild(el);
  },
  tokenize: async () => ({
    status: 'tokenized',
    token: asPaymentToken('tok_story'),
  }),
});

const STRIPE_PROVIDER: PaymentProvider = {
  provider: 'stripe',
  stripe: { publishable_key: 'pk_test_story' },
  mercadopago: null,
};

const PAID_SUBSCRIPTION = {
  id: 1,
  billing_state: 'active',
  billing_interval: 'monthly',
  add_ons: [],
} as unknown as Subscription;

function SeededDialog({
  subscription,
  resourceKey,
}: {
  subscription: Subscription | null;
  resourceKey?: 'event_occurrences';
}) {
  const [open, setOpen] = useState(true);
  const [client] = useState(() => {
    const c = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    c.setQueryData(
      billingPaymentProviderRetrieveOptions().queryKey,
      STRIPE_PROVIDER
    );
    return c;
  });
  return (
    <QueryClientProvider client={client}>
      <PurchaseAddOnDialog
        open={open}
        onOpenChange={setOpen}
        resourceKey={resourceKey}
        subscription={subscription}
        createSdk={fakeSdk}
      />
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Components/Billing/PurchaseAddOnDialog',
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Opened from a usage row — the resource is pre-selected and fixed. */
export const PreselectedResource: Story = {
  render: () => (
    <SeededDialog
      subscription={PAID_SUBSCRIPTION}
      resourceKey='event_occurrences'
    />
  ),
};

/** First-time buyer — a free org must supply a card, so the field shows up-front. */
export const FirstTimePurchase: Story = {
  render: () => (
    <SeededDialog subscription={null} resourceKey='event_occurrences' />
  ),
};

/** No preselection — the buyer picks a resource from the catalog. */
export const SelectableResource: Story = {
  render: () => <SeededDialog subscription={PAID_SUBSCRIPTION} />,
};

export const Mobile: Story = {
  render: () => (
    <SeededDialog subscription={null} resourceKey='event_occurrences' />
  ),
  globals: { viewport: { value: 'mobile' } },
};
