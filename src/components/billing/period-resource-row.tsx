/**
 * PeriodResourceRow — one resource's line on a closed-period statement
 * (`BillingPeriodResourceUsage`), the atom `PeriodStatementDetail` repeats.
 *
 * It renders the human resource label plus three values that a client must NOT
 * collapse into one another (Guiding Decision + the API field descriptions):
 *
 *   • `total` — the usage counted at close, via `formatResourceTotal`. A `null`
 *     total means the metric was **never recorded** for this period (a period
 *     that closed before the feature shipped, or a resource added after close)
 *     and renders as the explicit "Not recorded" string — NEVER as `0`. A
 *     recorded usage of zero is the integer `0` and renders as "0", visibly
 *     distinct from "Not recorded".
 *   • `limit_value` — the ceiling in force at close. A `null` limit means
 *     **Unlimited** — a DIFFERENT null than total's, rendered as "Unlimited",
 *     never conflated with "Not recorded".
 *   • `overage_unit_price` — the postpaid unit price, via `formatMoney` in the
 *     period's currency; absent for a prepaid resource or when no single stamped
 *     price applied.
 *
 * The per-organization attribution reuses the existing `UsageByOrganization`
 * component (the shape is identical to the current-usage breakdown).
 *
 * Presentational: renders from props only, so it stays a Server Component.
 */

import { Card, CardContent } from 'vinta-schedule-design-system/ui/card';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { HStack, Text, VStack } from 'vinta-schedule-design-system/layout';

import type { BillingPeriodResourceUsage } from '@/client';
import { formatMoney, formatResourceTotal } from '@/lib/billing/format';
import { resourceLabel } from '@/lib/billing/resource-labels';

import { UsageByOrganization } from './usage-by-organization';

export interface PeriodResourceRowProps {
  resource: BillingPeriodResourceUsage;
  /**
   * The statement's currency (from the parent `BillingPeriodSummaryDetail`),
   * used to format the postpaid `overage_unit_price`. A statement always
   * carries a currency, so this is required — there is no free / currency-less
   * closed period.
   */
  currency: string;
}

export function PeriodResourceRow({
  resource,
  currency,
}: PeriodResourceRowProps) {
  const label = resourceLabel(resource.resource_key);
  // Two DISTINCT nulls, deliberately not collapsed:
  //   total === null  → "Not recorded" (metric never captured), never "0".
  //   limit === null  → "Unlimited" (a different meaning entirely).
  const totalLabel = formatResourceTotal(resource.total);
  const isNotRecorded = resource.total === null;
  const limitLabel =
    resource.limit_value === null ? 'Unlimited' : String(resource.limit_value);
  const overagePrice =
    resource.overage_unit_price !== null
      ? formatMoney(resource.overage_unit_price, currency)
      : null;

  return (
    <Card data-testid='period-resource-row'>
      <CardContent className='pt-6'>
        <VStack gap={2} align='stretch'>
          <HStack justify='between' gap={4} align='center'>
            <Text weight='medium'>{label}</Text>
            {resource.kind !== null ? (
              <Badge variant='secondary' data-testid='period-resource-kind'>
                {resource.kind}
              </Badge>
            ) : null}
          </HStack>

          <HStack justify='between' gap={4} align='center'>
            <Text size='sm' color='muted-foreground'>
              Usage
            </Text>
            <Text
              size='sm'
              weight='medium'
              color={isNotRecorded ? 'muted-foreground' : 'foreground'}
              data-testid='period-resource-total'
            >
              {totalLabel}
            </Text>
          </HStack>

          <HStack justify='between' gap={4} align='center'>
            <Text size='sm' color='muted-foreground'>
              Limit
            </Text>
            <Text size='sm' weight='medium' data-testid='period-resource-limit'>
              {limitLabel}
            </Text>
          </HStack>

          {overagePrice ? (
            <HStack justify='between' gap={4} align='center'>
              <Text size='sm' color='muted-foreground'>
                Overage price
              </Text>
              <Text
                size='sm'
                weight='medium'
                data-testid='period-resource-overage-price'
              >
                {overagePrice} per unit
              </Text>
            </HStack>
          ) : null}

          <UsageByOrganization
            byOrganization={resource.by_organization}
            resourceLabel={label}
          />
        </VStack>
      </CardContent>
    </Card>
  );
}
