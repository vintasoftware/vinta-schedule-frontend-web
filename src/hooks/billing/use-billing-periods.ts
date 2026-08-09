/**
 * useBillingPeriods — the organization's closed-period statements
 * (`GET /billing/usage/periods/`, paginated, newest first).
 *
 * Thin wrapper over the generated `billingUsagePeriodsListOptions` factory
 * (canonical hook pattern — see use-group-scoped-quota.ts). Read-only; the
 * statement-history route (Phase 7) consumes it with date/charged filters.
 *
 * An org with no closed periods is an empty `200` list, not an error —
 * history is forward-only.
 */

import { useQuery } from '@tanstack/react-query';
import { billingUsagePeriodsListOptions } from '@/client/@tanstack/react-query.gen';
import type {
  BillingPeriodSummary,
  BillingUsagePeriodsListData,
} from '@/client';

// The `_id` the generated factory tags every billingUsagePeriodsList query
// key with.
export const BILLING_PERIODS_OPERATION_ID = 'billingUsagePeriodsList';

export function useBillingPeriods({
  filters,
  enabled = true,
}: {
  /**
   * Statement-list filters: `billing_period_start_after` /
   * `billing_period_start_before` (ISO instants) and `charged`, plus
   * `limit` / `offset` pagination.
   */
  filters?: BillingUsagePeriodsListData['query'];
  enabled?: boolean;
} = {}) {
  const periodsQuery = useQuery({
    ...billingUsagePeriodsListOptions({ query: filters }),
    enabled,
  });

  const periods: BillingPeriodSummary[] = periodsQuery.data?.results ?? [];

  return {
    periods,
    totalCount: periodsQuery.data?.count ?? 0,
    isLoading: periodsQuery.isLoading,
    isError: periodsQuery.isError,
    error: periodsQuery.error,
    periodsQuery,
  };
}
