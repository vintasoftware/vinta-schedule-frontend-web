/**
 * useBillingPlans — the plan catalog (`GET /billing/plans/`, paginated).
 *
 * Thin wrapper over the generated `billingPlansListOptions` factory (canonical
 * hook pattern — see use-appointment-type-scoped-quota.ts). Read-only in Phase 0; the
 * plan picker (Phase 3) consumes it.
 */

import { useQuery } from '@tanstack/react-query';
import { billingPlansListOptions } from '@/client/@tanstack/react-query.gen';
import type { BillingPlan, BillingPlansListData } from '@/client';

// The `_id` the generated factory tags every billingPlansList query key with.
export const BILLING_PLANS_OPERATION_ID = 'billingPlansList';

export function useBillingPlans({
  query,
  enabled = true,
}: {
  /** Passthrough catalog filters (`currency`, `is_active`, `limit`, `offset`). */
  query?: BillingPlansListData['query'];
  enabled?: boolean;
} = {}) {
  const plansQuery = useQuery({
    ...billingPlansListOptions({ query }),
    enabled,
  });

  const plans: BillingPlan[] = plansQuery.data?.results ?? [];

  return {
    plans,
    totalCount: plansQuery.data?.count ?? 0,
    isLoading: plansQuery.isLoading,
    isError: plansQuery.isError,
    error: plansQuery.error,
    plansQuery,
  };
}
