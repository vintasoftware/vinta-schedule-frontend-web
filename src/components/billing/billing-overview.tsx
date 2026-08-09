'use client';

/**
 * BillingOverview — the current-usage dashboard client island the `/billing`
 * page renders (Phase 2). The page itself stays a Server Component; this
 * component is the client boundary that calls the read hooks and composes the
 * presentational billing components.
 *
 * It reads `GET /billing/usage/` (`useBillingUsage`) for everything on screen —
 * billing state, plan snapshot, period bounds, per-resource usage, reseller
 * attribution, accrued overage — and `GET /billing/subscription/`
 * (`useSubscription`) only for the grace deadline the banner shows in
 * GRACE / RESTRICTED. Subscription is a supporting read: a free / no-sub org
 * answers `404` there, which is expected and never blocks the dashboard.
 *
 * States:
 *   • Loading — the usage query is in flight.
 *   • Access denied — usage errored (the `403` for no active organization, or a
 *     member without billing read access): a friendly alert, never a crash.
 *   • Rendered — the full dashboard. The free / subscription-less path
 *     (`billing_state: "free"`, null plan/period, unlimited rows,
 *     `estimated_overage_total: "0.0000"`) renders cleanly through the same
 *     composition — the presentational components handle the null/unlimited
 *     shapes.
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import {
  Center,
  Grid,
  Stack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';

import { useBillingUsage } from '@/hooks/billing/use-billing-usage';
import { useSubscription } from '@/hooks/billing/use-subscription';

import { BillingStateBanner } from './billing-state-banner';
import { OverageEstimate } from './overage-estimate';
import { PlanSummaryCard } from './plan-summary-card';
import { ResourceUsageList } from './resource-usage-list';

export function BillingOverview() {
  const { usage, isLoading, isError } = useBillingUsage();
  // Supporting read: the subscription supplies only the grace deadline the
  // banner shows in GRACE/RESTRICTED. A free/no-sub org answers 404 here, so
  // this never gates the dashboard — we read `grace_period_ends_at` optionally.
  const { subscription } = useSubscription();

  if (isLoading) {
    return (
      <Center grow>
        <Text color='muted-foreground'>Loading billing…</Text>
      </Center>
    );
  }

  if (isError || usage === null) {
    return (
      <Alert data-testid='billing-access-denied'>
        <AlertTitle>Billing isn&apos;t available</AlertTitle>
        <AlertDescription>
          We couldn&apos;t load your billing information. You may not have an
          active organization selected, or you may not have access to billing
          for this organization.
        </AlertDescription>
      </Alert>
    );
  }

  const currency = usage.plan?.currency ?? null;

  return (
    <Stack gap={6}>
      <BillingStateBanner
        billingState={usage.billing_state}
        gracePeriodEndsAt={subscription?.grace_period_ends_at ?? null}
      />

      <Grid columns={{ base: 1, md: 2 }} gap={4} align='start'>
        <PlanSummaryCard
          plan={usage.plan}
          billingPeriod={usage.billing_period}
        />
        <OverageEstimate
          estimatedOverageTotal={usage.estimated_overage_total}
          currency={currency}
        />
      </Grid>

      <VStack gap={3} align='stretch'>
        <Text weight='semibold'>Resource usage</Text>
        <ResourceUsageList limits={usage.limits} currency={currency} />
      </VStack>
    </Stack>
  );
}
