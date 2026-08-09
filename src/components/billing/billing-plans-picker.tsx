'use client';

/**
 * BillingPlansPicker — the plan catalog + upgrade/downgrade/cancel entry
 * (Phase 3). The `/billing/plans` server page renders this client island.
 *
 * It reads the catalog (`useBillingPlans`) and the current subscription
 * (`useSubscription`), highlights the plan the org is on, and exposes a
 * monthly/annual toggle DEFAULTING TO MONTHLY that both switches each card's
 * price (`monthly_price` / `annual_price` via `formatMoney`) and drives the
 * `billing_interval` handed to the change-plan dialog.
 *
 * Role gating is defense-in-depth: the upgrade/cancel affordances render only
 * for org ADMINS (the existing `useRole()` membership signal); the server `403`
 * on the write endpoints is the real gate. A member sees the catalog read-only.
 */

import * as React from 'react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from 'vinta-schedule-design-system/ui/tabs';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import {
  Center,
  Grid,
  HStack,
  Stack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';

import type { BillingPlan, PendingBillingIntervalEnum } from '@/client';
import { useBillingPlans } from '@/hooks/billing/use-billing-plans';
import { useSubscription } from '@/hooks/billing/use-subscription';
import { useRole } from '@/components/navigation/role-gate';
import { formatMoney } from '@/lib/billing/format';

import { ChangePlanDialog } from './change-plan-dialog';
import { CancelSubscriptionDialog } from './cancel-subscription-dialog';

/** The per-plan, per-interval price string, or `null` when not offered. */
function priceForInterval(
  plan: BillingPlan,
  interval: PendingBillingIntervalEnum
): string | null {
  return interval === 'annual' ? plan.annual_price : plan.monthly_price;
}

export function BillingPlansPicker() {
  const { plans, isLoading, isError } = useBillingPlans();
  // A free / subscription-less org answers 404 here; that's expected and never
  // blocks the catalog — it just means there's no current plan to highlight.
  const { subscription } = useSubscription();
  const role = useRole();
  const isAdmin = role === 'admin';

  const [interval, setInterval] =
    React.useState<PendingBillingIntervalEnum>('monthly');
  const [changePlan, setChangePlan] = React.useState<BillingPlan | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const currentSlug = subscription?.plan.slug ?? null;
  // Cancel only applies to an org actually on a paid plan.
  const hasPaidPlan =
    subscription !== null &&
    subscription.billing_state !== 'free' &&
    subscription.billing_state !== 'cancelled';

  if (isLoading) {
    return (
      <Center grow>
        <Text color='muted-foreground'>Loading plans…</Text>
      </Center>
    );
  }

  if (isError) {
    return (
      <Alert data-testid='plans-load-error'>
        <AlertTitle>Couldn&apos;t load plans</AlertTitle>
        <AlertDescription>
          We couldn&apos;t load the plan catalog right now. Please try again in
          a moment.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Stack gap={5}>
      <HStack justify='between' align='center' wrap>
        <Text weight='semibold'>Choose a plan</Text>
        <Tabs
          value={interval}
          onValueChange={(value) =>
            setInterval(value as PendingBillingIntervalEnum)
          }
        >
          <TabsList aria-label='Billing interval'>
            <TabsTrigger value='monthly' data-testid='interval-monthly'>
              Monthly
            </TabsTrigger>
            <TabsTrigger value='annual' data-testid='interval-annual'>
              Annual
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </HStack>

      <Grid
        columns={{ base: 1, '@lg/content': 2, '@3xl/content': 3 }}
        gap={4}
        align='stretch'
      >
        {plans.map((plan) => {
          const isCurrent = plan.slug === currentSlug;
          const price = priceForInterval(plan, interval);
          const priceLabel =
            price === null ? null : formatMoney(price, plan.currency);

          return (
            <Card
              key={plan.slug}
              data-testid={`plan-card-${plan.slug}`}
              data-current={isCurrent || undefined}
              className={isCurrent ? 'border-primary' : undefined}
            >
              <CardHeader>
                <HStack gap={2} align='center' justify='between'>
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent && (
                    <Badge
                      variant='info'
                      data-testid={`plan-current-${plan.slug}`}
                    >
                      Current plan
                    </Badge>
                  )}
                </HStack>
              </CardHeader>
              <CardContent>
                <VStack gap={4} align='stretch'>
                  <VStack gap={0} align='start'>
                    {priceLabel === null ? (
                      <Text
                        size='sm'
                        color='muted-foreground'
                        data-testid={`plan-price-${plan.slug}`}
                      >
                        Annual billing not available
                      </Text>
                    ) : (
                      <HStack gap={1} align='baseline'>
                        <Text
                          size='xl'
                          weight='semibold'
                          data-testid={`plan-price-${plan.slug}`}
                        >
                          {priceLabel}
                        </Text>
                        <Text size='sm' color='muted-foreground'>
                          /{interval === 'annual' ? 'year' : 'month'}
                        </Text>
                      </HStack>
                    )}
                  </VStack>

                  {isAdmin &&
                    (isCurrent && hasPaidPlan ? (
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => setCancelOpen(true)}
                        data-testid={`plan-cancel-${plan.slug}`}
                      >
                        Cancel plan
                      </Button>
                    ) : !isCurrent ? (
                      <Button
                        type='button'
                        onClick={() => setChangePlan(plan)}
                        disabled={price === null}
                        data-testid={`plan-change-${plan.slug}`}
                      >
                        {hasPaidPlan ? 'Switch to this plan' : 'Upgrade'}
                      </Button>
                    ) : null)}
                </VStack>
              </CardContent>
            </Card>
          );
        })}
      </Grid>

      {changePlan !== null && (
        <ChangePlanDialog
          // Per-attempt identity: keying on the target slug forces a fresh mount
          // (fresh idempotency holder + phase + card field) on an A→B switch
          // without an intervening close, so a distinct plan selection can never
          // reuse the previous attempt's idempotency key for a different plan.
          key={changePlan.slug}
          open={changePlan !== null}
          onOpenChange={(open) => {
            if (!open) setChangePlan(null);
          }}
          plan={changePlan}
          billingInterval={interval}
          subscription={subscription}
        />
      )}

      <CancelSubscriptionDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        subscription={subscription}
      />
    </Stack>
  );
}
