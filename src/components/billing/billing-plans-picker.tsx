'use client';

/**
 * BillingPlansPicker — the plan catalog + upgrade/downgrade/cancel entry
 * (Phase 3). The `/billing/plans` server page renders this client island.
 *
 * It reads the current subscription (`useSubscription`) first so the catalog
 * read (`useBillingPlans`) can filter to the org's own billing currency
 * (`subscription.plan.currency`) — a multi-currency catalog would otherwise
 * mix prices you can't actually be charged in. A free / subscription-less org
 * (404 on `useSubscription`) has no currency to filter to, so it sees the
 * unfiltered catalog. It highlights the plan the org is on, renders each
 * plan's limits + entitlements, and exposes a monthly/annual toggle DEFAULTING
 * TO MONTHLY that both switches each card's price (`monthly_price` /
 * `annual_price` via `formatMoney`) and drives the `billing_interval` handed
 * to the change-plan dialog.
 *
 * Capability gating is defense-in-depth: the upgrade/cancel affordances render
 * only for members who hold `payments.manage_billing`; the server `403` on the
 * write endpoints is the real gate. A member sees the catalog read-only.
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
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
import {
  Center,
  Grid,
  HStack,
  Stack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';

import type {
  BillingPlan,
  PendingBillingIntervalEnum,
  Subscription,
} from '@/client';
import { useBillingPlans } from '@/hooks/billing/use-billing-plans';
import { useSubscription } from '@/hooks/billing/use-subscription';
import {
  useHasPermission,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';
import { formatMoney } from '@/lib/billing/format';
import { entitlementLabel } from '@/lib/billing/entitlement-labels';
import { resourceLabel } from '@/lib/billing/resource-labels';

import { ChangePlanDialog } from './change-plan-dialog';
import { CancelSubscriptionDialog } from './cancel-subscription-dialog';

/** The per-plan, per-interval price string, or `null` when not offered. */
function priceForInterval(
  plan: BillingPlan,
  interval: PendingBillingIntervalEnum
): string | null {
  return interval === 'annual' ? plan.annual_price : plan.monthly_price;
}

/** The per-plan, per-interval price parsed to a number, or `null` when not offered/unparseable. */
function numericPriceForInterval(
  plan: BillingPlan,
  interval: PendingBillingIntervalEnum
): number | null {
  const raw = priceForInterval(plan, interval);
  if (raw === null) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * The action label for a card's change-plan button, by direction relative to
 * the org's current plan. The backend decides upgrade vs. downgrade by
 * comparing the current plan at the SUBSCRIPTION'S OWN interval against the
 * target plan at the requested (toggle) interval — not both plans at the same
 * interval — so this mirrors that as closely as a pre-initiate label can:
 * `subscription.billing_interval` prices the current plan, `interval` prices
 * the target. This is still only a label, never a gate — the actual decision
 * is read off the initiate response (see `ChangePlanDialog`). When a robust
 * comparison isn't possible (no subscription, or a missing price on either
 * side) this defaults to "Upgrade" — the safer label when direction is
 * ambiguous.
 */
function changeActionLabel(
  targetPlan: BillingPlan,
  targetInterval: PendingBillingIntervalEnum,
  subscription: Subscription | null
): string {
  if (subscription === null) {
    return 'Upgrade';
  }
  const currentPrice = numericPriceForInterval(
    subscription.plan,
    subscription.billing_interval
  );
  const targetPrice = numericPriceForInterval(targetPlan, targetInterval);
  if (currentPrice === null || targetPrice === null) {
    return 'Upgrade';
  }
  return targetPrice < currentPrice ? 'Downgrade' : 'Upgrade';
}

export function BillingPlansPicker() {
  // A free / subscription-less org answers 404 here; that's expected and never
  // blocks the catalog — it just means there's no current plan to highlight,
  // and no currency to filter the catalog to (below).
  const { subscription } = useSubscription();
  const canManageBilling = useHasPermission(PERMISSIONS.manageBilling);
  // The org's own billing currency, when it has one — the catalog read filters
  // to it so a member never sees a price they can't actually be charged in.
  const currency = subscription?.plan.currency;
  const { plans, isLoading, isError } = useBillingPlans({
    query: currency ? { currency } : undefined,
  });

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
          // Only the entitlements this plan actually grants are worth
          // showing — a disabled entitlement is a non-feature, not a bullet.
          const enabledEntitlements = plan.entitlements.filter(
            (entitlement) => entitlement.is_enabled
          );

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

                  <VStack
                    gap={1}
                    align='start'
                    data-testid={`plan-limits-${plan.slug}`}
                  >
                    <Text size='xs' color='muted-foreground' uppercase>
                      Included limits
                    </Text>
                    <List variant='plain' gap={1}>
                      {plan.limits.map((limit) => (
                        <ListItem key={limit.resource_key}>
                          <Text size='sm'>
                            {resourceLabel(limit.resource_key)}:{' '}
                            {limit.limit_value === null
                              ? 'Unlimited'
                              : limit.limit_value}
                          </Text>
                        </ListItem>
                      ))}
                    </List>
                  </VStack>

                  {enabledEntitlements.length > 0 && (
                    <VStack
                      gap={1}
                      align='start'
                      data-testid={`plan-entitlements-${plan.slug}`}
                    >
                      <Text size='xs' color='muted-foreground' uppercase>
                        Includes
                      </Text>
                      <HStack gap={2} wrap>
                        {enabledEntitlements.map((entitlement) => (
                          <Badge
                            key={entitlement.entitlement_key}
                            variant='outline'
                            data-testid={`plan-entitlement-${plan.slug}-${entitlement.entitlement_key}`}
                          >
                            {entitlementLabel(entitlement.entitlement_key)}
                          </Badge>
                        ))}
                      </HStack>
                    </VStack>
                  )}

                  {canManageBilling &&
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
                        {hasPaidPlan
                          ? changeActionLabel(plan, interval, subscription)
                          : 'Upgrade'}
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
