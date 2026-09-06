/**
 * useBillingUsage — the organization's current-cycle usage against effective
 * limits (`GET /billing/usage/`).
 *
 * A thin wrapper over the generated `billingUsageRetrieveUsageRetrieveOptions`
 * factory (canonical hook pattern — see use-appointment-type-scoped-quota.ts). Read-only;
 * the write flows that invalidate this key land with their own phases.
 *
 * The endpoint fails open: a subscription-less org returns `billing_state:
 * "free"`, a null plan/period, unlimited rows and `estimated_overage_total:
 * "0.0000"` rather than an error — so this hook does not special-case that,
 * it just surfaces the payload.
 */

import { useQuery } from '@tanstack/react-query';
import { billingUsageRetrieveUsageRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import type { UsageResponse } from '@/client';

// The `_id` the generated factory tags every billingUsageRetrieveUsageRetrieve
// query key with. Exported so later mutation phases invalidate on the same
// string rather than re-deriving it.
export const BILLING_USAGE_OPERATION_ID = 'billingUsageRetrieveUsageRetrieve';

export function useBillingUsage({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const usageQuery = useQuery({
    ...billingUsageRetrieveUsageRetrieveOptions(),
    enabled,
  });

  const usage: UsageResponse | null = usageQuery.data ?? null;

  return {
    usage,
    isLoading: usageQuery.isLoading,
    isError: usageQuery.isError,
    error: usageQuery.error,
    usageQuery,
  };
}
