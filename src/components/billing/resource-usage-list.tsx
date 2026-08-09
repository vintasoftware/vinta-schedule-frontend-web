/**
 * ResourceUsageList — the per-resource usage rows over the usage payload's
 * `limits` (`EffectiveLimitUsage[]`).
 *
 * A thin list wrapper around `ResourceUsageRow`, keyed by `resource_key`. It
 * threads the plan currency down so postpaid rows can format their overage
 * price. An empty `limits` array renders a plain empty note rather than nothing.
 *
 * Presentational: renders from props only, so it stays a Server Component.
 */

import { Text, VStack } from 'vinta-schedule-design-system/layout';

import type { EffectiveLimitUsage } from '@/client';

import { ResourceUsageRow } from './resource-usage-row';

export interface ResourceUsageListProps {
  limits: EffectiveLimitUsage[];
  /** The plan's currency, threaded to each row's overage formatting. */
  currency: string | null;
  /**
   * Opens the add-on purchase dialog pre-selected to a row's resource (Phase 4),
   * threaded to each row. Provided by the parent only for a caller allowed to
   * buy (admin); absent means no "Buy more" affordance renders.
   */
  onBuyMore?: (resourceKey: string) => void;
}

export function ResourceUsageList({
  limits,
  currency,
  onBuyMore,
}: ResourceUsageListProps) {
  if (limits.length === 0) {
    return (
      <Text
        size='sm'
        color='muted-foreground'
        data-testid='resource-usage-empty'
      >
        No metered resources to show.
      </Text>
    );
  }

  return (
    <VStack gap={3} align='stretch' data-testid='resource-usage-list'>
      {limits.map((limit) => (
        <ResourceUsageRow
          key={limit.resource_key}
          limit={limit}
          currency={currency}
          onBuyMore={onBuyMore}
        />
      ))}
    </VStack>
  );
}
