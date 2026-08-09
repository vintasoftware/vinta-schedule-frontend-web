/**
 * ResourceUsageRow — one resource's usage against its effective limit
 * (`EffectiveLimitUsage`), the atom the current-usage dashboard repeats.
 *
 * It renders: the human resource label, a usage bar of `current_usage` vs
 * `limit_value`, the `included_in_plan` vs `add_on_quantity` split that
 * decomposes the limit, the postpaid `overage_unit_price` (via `formatMoney`,
 * in the plan's currency), and — for pooled resellers — the per-organization
 * attribution (only when >1 org contributed). A `limit_value` of null renders
 * as "Unlimited" with no bar.
 *
 * Presentational: renders from props only (the Progress atom it uses is a
 * client component, but this row holds no state of its own).
 */

import { Plus } from 'lucide-react';

import { Card, CardContent } from 'vinta-schedule-design-system/ui/card';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { Progress } from 'vinta-schedule-design-system/ui/progress';
import { HStack, Text, VStack } from 'vinta-schedule-design-system/layout';

import type { EffectiveLimitUsage } from '@/client';
import { formatMoney } from '@/lib/billing/format';
import { resourceLabel } from '@/lib/billing/resource-labels';

import { UsageByOrganization } from './usage-by-organization';

export interface ResourceUsageRowProps {
  limit: EffectiveLimitUsage;
  /**
   * The plan's currency (from the usage payload's `plan.currency`), used to
   * format the postpaid overage price. `null` for a free / subscription-less
   * org — there is no money to format then, and such rows are unlimited anyway.
   */
  currency: string | null;
  /**
   * Opens the add-on purchase dialog pre-selected to this row's resource
   * (Phase 4). Provided by the parent ONLY for a caller allowed to buy (admin);
   * when absent, no "Buy more" affordance renders — so the row stays a pure
   * presentational Server Component and the role gate lives with the parent that
   * owns the dialog state. Not shown for an unlimited resource (nothing to buy).
   */
  onBuyMore?: (resourceKey: string) => void;
}

/** Clamps the usage-vs-limit ratio to a 0–100 bar percentage. */
function usagePercent(used: number, limitValue: number): number {
  if (limitValue <= 0) {
    return used > 0 ? 100 : 0;
  }
  return Math.min(100, Math.round((used / limitValue) * 100));
}

export function ResourceUsageRow({
  limit,
  currency,
  onBuyMore,
}: ResourceUsageRowProps) {
  const label = resourceLabel(limit.resource_key);
  const isUnlimited = limit.limit_value === null;
  const used = limit.current_usage ?? 0;
  // "Buy more" is scoped to a PRE-PAID resource near or over its limit (>=80%
  // used, over-limit included). A postpaid resource bills overage automatically
  // — there is nothing to pre-buy — and a comfortably-under-limit prepaid row
  // needs no prompt. Unlimited rows fall out via the null-limit guard.
  const isNearLimit =
    limit.limit_value !== null &&
    limit.current_usage !== null &&
    limit.current_usage / limit.limit_value >= 0.8;
  const showBuyMore =
    onBuyMore !== undefined && limit.kind === 'prepaid' && isNearLimit;

  const showSplit = !isUnlimited && limit.included_in_plan !== null;
  const overagePrice =
    limit.kind === 'postpaid' &&
    limit.overage_unit_price !== null &&
    currency !== null
      ? formatMoney(limit.overage_unit_price, currency)
      : null;

  return (
    <Card data-testid='resource-usage-row'>
      <CardContent className='pt-6'>
        <VStack gap={2} align='stretch'>
          <HStack justify='between' gap={4} align='center'>
            <Text weight='medium'>{label}</Text>
            <HStack gap={3} align='center'>
              {isUnlimited ? (
                <Badge variant='teal' data-testid='resource-unlimited'>
                  Unlimited
                </Badge>
              ) : (
                <Text
                  size='sm'
                  color='muted-foreground'
                  data-testid='resource-usage-count'
                >
                  {used} / {limit.limit_value}
                </Text>
              )}
              {showBuyMore ? (
                <Button
                  type='button'
                  variant='outline'
                  size='xs'
                  onClick={() => onBuyMore?.(limit.resource_key)}
                  data-testid='resource-buy-more'
                >
                  <Icon icon={Plus} size='xs' /> Buy more
                </Button>
              ) : null}
            </HStack>
          </HStack>

          {!isUnlimited && limit.limit_value !== null ? (
            <Progress
              value={usagePercent(used, limit.limit_value)}
              aria-label={`${label} usage`}
            />
          ) : null}

          {showSplit ? (
            <Text
              size='xs'
              color='muted-foreground'
              data-testid='resource-split'
            >
              {limit.included_in_plan} included in plan
              {limit.add_on_quantity > 0
                ? ` + ${limit.add_on_quantity} from add-ons`
                : ''}
            </Text>
          ) : null}

          {overagePrice ? (
            <Text
              size='xs'
              color='muted-foreground'
              data-testid='resource-overage-price'
            >
              Overage: {overagePrice} per unit
            </Text>
          ) : null}

          <UsageByOrganization
            byOrganization={limit.by_organization}
            resourceLabel={label}
          />
        </VStack>
      </CardContent>
    </Card>
  );
}
