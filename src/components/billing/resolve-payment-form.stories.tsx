import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { Box, VStack, Text } from 'vinta-schedule-design-system/layout';
import { Card, CardContent } from 'vinta-schedule-design-system/ui/card';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import type { PaymentProvider, Subscription } from '@/client';
import { billingPaymentProviderRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import { asPaymentToken } from '@/lib/billing/payment-token';
import type { PaymentProviderSdkFactory } from '@/lib/billing/payment-provider-sdk';

import { ResolvePaymentForm } from './resolve-payment-form';

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

const GRACE_SUBSCRIPTION = {
  id: 1,
  plan: {
    id: 2,
    slug: 'team',
    name: 'Team',
    currency: 'USD',
    monthly_price: '20.0000',
    annual_price: '200.0000',
  },
  billing_state: 'grace',
  billing_interval: 'monthly',
  grace_period_ends_at: '2026-09-01T12:00:00Z',
  pending_plan_slug: '',
} as unknown as Subscription;

const RESTRICTED_SUBSCRIPTION = {
  ...GRACE_SUBSCRIPTION,
  billing_state: 'restricted',
  grace_period_ends_at: null,
} as unknown as Subscription;

function SeededForm({ subscription }: { subscription: Subscription }) {
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
      <Box className='w-full max-w-md'>
        <ResolvePaymentForm subscription={subscription} createSdk={fakeSdk} />
      </Box>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Components/Billing/ResolvePaymentForm',
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Grace period — a deadline is shown; the org keeps its current plan. */
export const GracePeriod: Story = {
  render: () => <SeededForm subscription={GRACE_SUBSCRIPTION} />,
};

/** Restricted — access is already limited; no grace deadline remains. */
export const Restricted: Story = {
  render: () => <SeededForm subscription={RESTRICTED_SUBSCRIPTION} />,
};

/**
 * Needs upgrade — the org has never attached a payment method and must choose a
 * plan before retrying payment. This state is reached when `useRetryPayment`
 * returns a `subscription_not_attached` error (code 409), indicating the org
 * never attached an instrument at the provider and must go through the
 * first-payment/upgrade flow. The form renders the upgrade card directing the
 * user to `/billing/plans`.
 */
export const NeedsUpgrade: Story = {
  render: () => (
    <Box className='w-full max-w-md'>
      <Card data-testid='resolve-payment-needs-upgrade'>
        <CardContent>
          <VStack gap={3} py={4} align='center'>
            <Icon icon={TriangleAlert} color='muted-foreground' />
            <Text weight='medium'>This organization has never paid yet</Text>
            <Text size='sm' color='muted-foreground' align='center'>
              There&apos;s no payment method on file to retry. Choose a plan and
              add a payment method to get started.
            </Text>
            <Button asChild>
              <Link href='/billing/plans'>Choose a plan</Link>
            </Button>
          </VStack>
        </CardContent>
      </Card>
    </Box>
  ),
};

export const Mobile: Story = {
  render: () => <SeededForm subscription={GRACE_SUBSCRIPTION} />,
  globals: { viewport: { value: 'mobile' } },
};
