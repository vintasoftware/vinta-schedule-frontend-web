/**
 * PlanSummaryCard — the plan snapshot + current billing-cycle bounds from
 * `GET /billing/usage/` (`plan`, `billing_period`), plus the billing interval
 * and any pending plan change from `GET /billing/subscription/` (Phase 2).
 *
 * When the org has a subscription it shows the plan name, its slug as a badge,
 * the period start–end via `formatPeriod`, the billing interval (monthly /
 * annual), and — only when a change is pending (`pending_plan_slug` is
 * non-empty) — a "Plan changes to {slug} on {date}" line. When `plan` /
 * `billing_period` are null (a free / subscription-less org, the API's
 * fail-open shape) it renders a plain "Free plan — no billing cycle" state
 * instead of empty fields.
 *
 * Presentational: renders from props only, so it stays a Server Component.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { HStack, Text, VStack } from 'vinta-schedule-design-system/layout';

import type {
  BillingPeriodBounds,
  BillingPlanSnapshot,
  PendingBillingIntervalEnum,
  Subscription,
} from '@/client';
import { formatPeriod } from '@/lib/billing/format';

const BILLING_INTERVAL_LABELS: Record<PendingBillingIntervalEnum, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
};

/** Humanizes a `PendingBillingIntervalEnum`, falling back to the raw value. */
function intervalLabel(interval: string): string {
  return (
    BILLING_INTERVAL_LABELS[interval as PendingBillingIntervalEnum] ?? interval
  );
}

export interface PlanSummaryCardProps {
  /** The plan in force this cycle; `null` for a free / subscription-less org. */
  plan: BillingPlanSnapshot | null;
  /** The current cycle's bounds; `null` for a free / subscription-less org. */
  billingPeriod: BillingPeriodBounds | null;
  /**
   * The current subscription, supplying `billing_interval` and any pending
   * plan change (`pending_plan_slug` / `pending_plan_effective_at`). `null` or
   * `undefined` for a free org or while the supporting read (`useSubscription`
   * — a 404 for a free org, never a dashboard-blocking error) hasn't resolved
   * yet; the card simply omits the interval/pending lines then.
   */
  subscription?: Subscription | null;
}

export function PlanSummaryCard({
  plan,
  billingPeriod,
  subscription,
}: PlanSummaryCardProps) {
  if (plan === null) {
    return (
      <Card data-testid='plan-summary-card'>
        <CardHeader>
          <CardTitle>Free plan</CardTitle>
        </CardHeader>
        <CardContent>
          <Text size='sm' color='muted-foreground'>
            No billing cycle — you are on the free plan.
          </Text>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid='plan-summary-card'>
      <CardHeader>
        <HStack gap={2} align='center'>
          <CardTitle>{plan.name}</CardTitle>
          <Badge variant='info' data-testid='plan-slug'>
            {plan.slug}
          </Badge>
        </HStack>
      </CardHeader>
      <CardContent>
        <VStack gap={3} align='start'>
          <VStack gap={1} align='start'>
            <Text size='xs' color='muted-foreground' uppercase>
              Current billing period
            </Text>
            {billingPeriod ? (
              <Text size='sm' data-testid='billing-period'>
                {formatPeriod(billingPeriod.start)} –{' '}
                {formatPeriod(billingPeriod.end)}
              </Text>
            ) : (
              <Text size='sm' color='muted-foreground'>
                No active billing cycle.
              </Text>
            )}
          </VStack>

          {subscription?.billing_interval && (
            <Text
              size='sm'
              color='muted-foreground'
              data-testid='billing-interval'
            >
              {intervalLabel(subscription.billing_interval)} billing
            </Text>
          )}

          {subscription?.pending_plan_slug && (
            <Text size='sm' data-testid='pending-plan-change'>
              Plan changes to {subscription.pending_plan_slug}
              {subscription.pending_plan_effective_at
                ? ` on ${formatPeriod(subscription.pending_plan_effective_at)}`
                : ''}
            </Text>
          )}
        </VStack>
      </CardContent>
    </Card>
  );
}
