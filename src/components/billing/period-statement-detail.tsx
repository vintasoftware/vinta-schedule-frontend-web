/**
 * PeriodStatementDetail — one closed billing period rendered as a durable
 * statement (`BillingPeriodSummaryDetail`), composing the header snapshot with
 * the per-resource `resources[]` breakdown.
 *
 * The header carries the period bounds (`formatPeriod`), the plan snapshot as
 * of close (`plan_name` + `plan_slug`), the billing interval, the overage total
 * (`formatMoney` in the period's `currency`), and whether that overage was
 * actually charged. Each resource line is a `PeriodResourceRow`, which keeps
 * the two distinct nulls (`total` = "Not recorded" vs `limit_value` =
 * "Unlimited") from being conflated.
 *
 * The statement carries NO reconciliation data — the API never serializes it
 * (internal investigation data, Django-admin only), so this surface has none to
 * render.
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
import {
  HStack,
  Stack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';

import type { BillingPeriodSummaryDetail } from '@/client';
import { formatMoney, formatPeriod } from '@/lib/billing/format';

import { PeriodResourceRow } from './period-resource-row';

export interface PeriodStatementDetailProps {
  period: BillingPeriodSummaryDetail;
}

export function PeriodStatementDetail({ period }: PeriodStatementDetailProps) {
  return (
    <Stack gap={6}>
      <Card data-testid='period-statement-header'>
        <CardHeader>
          <VStack gap={2} align='start'>
            <HStack gap={2} align='center' wrap>
              <CardTitle>{period.plan_name}</CardTitle>
              <Badge variant='info' data-testid='statement-plan-slug'>
                {period.plan_slug}
              </Badge>
              <Badge variant='secondary'>{period.billing_interval}</Badge>
            </HStack>
            <Text
              size='sm'
              color='muted-foreground'
              data-testid='statement-period'
            >
              {formatPeriod(period.billing_period_start)} –{' '}
              {formatPeriod(period.billing_period_end)}
            </Text>
          </VStack>
        </CardHeader>
        <CardContent>
          <HStack justify='between' gap={4} align='center' wrap>
            <VStack gap={0} align='start'>
              <Text size='xs' color='muted-foreground' uppercase>
                Overage total
              </Text>
              <Text
                size='xl'
                weight='semibold'
                data-testid='statement-overage-total'
              >
                {formatMoney(period.overage_total, period.currency)}
              </Text>
            </VStack>
            {period.charged ? (
              <Badge variant='success' data-testid='statement-charged'>
                Charged
              </Badge>
            ) : (
              <Badge variant='secondary' data-testid='statement-not-charged'>
                Not charged
              </Badge>
            )}
          </HStack>
        </CardContent>
      </Card>

      <VStack gap={3} align='stretch'>
        <Text weight='semibold'>Resource usage this period</Text>
        {period.resources.length === 0 ? (
          <Text
            size='sm'
            color='muted-foreground'
            data-testid='statement-no-resources'
          >
            No per-resource usage was recorded for this period.
          </Text>
        ) : (
          <VStack gap={3} align='stretch'>
            {period.resources.map((resource) => (
              <PeriodResourceRow
                key={resource.resource_key}
                resource={resource}
                currency={period.currency}
              />
            ))}
          </VStack>
        )}
      </VStack>
    </Stack>
  );
}
