/**
 * useBillingPeriod — one closed-period statement's detail, including the
 * per-resource `resources[]` breakdown (`GET /billing/usage/periods/{id}/`).
 *
 * Thin wrapper over the generated `billingUsagePeriodsRetrieveOptions` factory
 * (canonical hook pattern — see use-appointment-type-scoped-quota.ts). Read-only; the
 * statement-detail route (Phase 7) consumes it.
 *
 * Gated with `enabled: id != null` so the fetch never fires without an id (a
 * detail route mounting before its param resolves). A pk outside the caller's
 * pool answers `404`; the generated factory throws on non-2xx, so that
 * surfaces as `isError` — the not-found routing is Phase 7's concern.
 */

import { useQuery } from '@tanstack/react-query';
import { billingUsagePeriodsRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import type { BillingPeriodSummaryDetail } from '@/client';

// The `_id` the generated factory tags every billingUsagePeriodsRetrieve
// query key with.
export const BILLING_PERIOD_OPERATION_ID = 'billingUsagePeriodsRetrieve';

export function useBillingPeriod(
  id: string | null | undefined,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const periodQuery = useQuery({
    ...billingUsagePeriodsRetrieveOptions({ path: { id: id ?? '' } }),
    // Never fetch without an id — the detail route may mount before its param
    // resolves.
    enabled: enabled && id != null,
  });

  const period: BillingPeriodSummaryDetail | null = periodQuery.data ?? null;

  return {
    period,
    isLoading: periodQuery.isLoading,
    isError: periodQuery.isError,
    error: periodQuery.error,
    periodQuery,
  };
}
