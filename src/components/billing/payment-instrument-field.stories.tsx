import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import type { PaymentProvider } from '@/client';
import { billingPaymentProviderRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import { asPaymentToken } from '@/lib/billing/payment-token';
import type { PaymentProviderSdkFactory } from '@/lib/billing/payment-provider-sdk';
import { PaymentInstrumentField } from './payment-instrument-field';

// A fake SDK factory so the story never loads a real provider script or touches
// the network — it mounts a placeholder "card element" into the container the
// component hands it, mirroring how tests inject a fake.
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

// A factory whose SDK fails to load → the component's load-failed error state.
const failingSdk: PaymentProviderSdkFactory = () => ({
  load: async () => {
    throw new Error('mock: provider SDK failed to load');
  },
  mountCardElement: async () => {},
  tokenize: async () => ({
    status: 'error',
    reason: 'sdk_load_failed',
    message: 'The payment field failed to load. Please try again.',
  }),
});

const STRIPE_PROVIDER: PaymentProvider = {
  provider: 'stripe',
  stripe: { publishable_key: 'pk_test_story' },
  mercadopago: null,
};

const MERCADOPAGO_PROVIDER: PaymentProvider = {
  provider: 'mercadopago',
  stripe: null,
  mercadopago: { public_key: 'MP_PUB_story' },
};

// Provider with its credential missing → the component's "payments unavailable"
// branch, reproduced without needing a real 409 from the network.
const UNCONFIGURED_PROVIDER: PaymentProvider = {
  provider: 'stripe',
  stripe: null,
  mercadopago: null,
};

// Seeds the payment-provider query so `usePaymentProvider` resolves from cache
// instead of fetching.
function SeededField({
  provider,
  createSdk = fakeSdk,
}: {
  provider: PaymentProvider;
  createSdk?: PaymentProviderSdkFactory;
}) {
  const [client] = useState(() => {
    const c = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    c.setQueryData(billingPaymentProviderRetrieveOptions().queryKey, provider);
    return c;
  });
  return (
    <QueryClientProvider client={client}>
      <div className='w-full max-w-md'>
        <PaymentInstrumentField createSdk={createSdk} />
      </div>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Components/Billing/PaymentInstrumentField',
  component: PaymentInstrumentField,
  tags: ['autodocs'],
} satisfies Meta<typeof PaymentInstrumentField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Stripe: Story = {
  render: () => <SeededField provider={STRIPE_PROVIDER} />,
};

export const MercadoPago: Story = {
  render: () => <SeededField provider={MERCADOPAGO_PROVIDER} />,
};

export const Unavailable: Story = {
  render: () => <SeededField provider={UNCONFIGURED_PROVIDER} />,
};

export const LoadFailed: Story = {
  render: () => (
    <SeededField provider={STRIPE_PROVIDER} createSdk={failingSdk} />
  ),
};

export const Mobile: Story = {
  render: () => <SeededField provider={STRIPE_PROVIDER} />,
  globals: { viewport: { value: 'mobile' } },
};
