/**
 * PlanSummaryCard — the plan snapshot + current billing-cycle bounds from
 * `GET /billing/usage/` (`plan`, `billing_period`).
 *
 * When the org has a subscription it shows the plan name, its slug as a badge,
 * and the period start–end via `formatPeriod`. When `plan` / `billing_period`
 * are null (a free / subscription-less org, the API's fail-open shape) it
 * renders a plain "Free plan — no billing cycle" state instead of empty fields.
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

import type { BillingPeriodBounds, BillingPlanSnapshot } from '@/client';
import { formatPeriod } from '@/lib/billing/format';

export interface PlanSummaryCardProps {
  /** The plan in force this cycle; `null` for a free / subscription-less org. */
  plan: BillingPlanSnapshot | null;
  /** The current cycle's bounds; `null` for a free / subscription-less org. */
  billingPeriod: BillingPeriodBounds | null;
}

export function PlanSummaryCard({ plan, billingPeriod }: PlanSummaryCardProps) {
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
      </CardContent>
    </Card>
  );
}
