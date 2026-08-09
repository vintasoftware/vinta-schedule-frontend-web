import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import type { BillingPlan, PaymentProvider, Subscription } from '@/client';
import { billingPaymentProviderRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import { asPaymentToken } from '@/lib/billing/payment-token';
import type { PaymentProviderSdkFactory } from '@/lib/billing/payment-provider-sdk';

import { ChangePlanDialog } from './change-plan-dialog';

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

const TEAM_PLAN: BillingPlan = {
  id: 2,
  slug: 'team',
  name: 'Team',
  is_active: true,
  is_default_for_new_organizations: false,
  monthly_price: '20.0000',
  annual_price: '200.0000',
  currency: 'USD',
  grace_period_days: 7,
  limits: [],
  entitlements: [],
};

const PAID_SUBSCRIPTION = {
  id: 1,
  plan: { ...TEAM_PLAN, slug: 'starter', name: 'Starter' },
  billing_state: 'active',
  billing_interval: 'monthly',
  pending_plan_slug: '',
} as unknown as Subscription;

function SeededDialog({ subscription }: { subscription: Subscription | null }) {
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
      <ChangePlanDialog
        open={open}
        onOpenChange={setOpen}
        plan={TEAM_PLAN}
        billingInterval='monthly'
        subscription={subscription}
        createSdk={fakeSdk}
      />
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Components/Billing/ChangePlanDialog',
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** First-time upgrade — a free org must supply a card, so the field shows up-front. */
export const FirstTimeUpgrade: Story = {
  render: () => <SeededDialog subscription={null} />,
};

/** Returning upgrade — an already-paying org changes plan without re-collecting a card. */
export const ReturningUpgrade: Story = {
  render: () => <SeededDialog subscription={PAID_SUBSCRIPTION} />,
};

export const Mobile: Story = {
  render: () => <SeededDialog subscription={null} />,
  globals: { viewport: { value: 'mobile' } },
};
