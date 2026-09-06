/**
 * useOccurrenceLedger — the metered-occurrence ledger backing the org's
 * post-paid charges (`GET /billing/usage/occurrences/`, paginated, newest
 * first).
 *
 * Thin wrapper over the generated `billingUsageOccurrencesListOptions` factory
 * (canonical hook pattern — see use-appointment-type-scoped-quota.ts). Read-only; the
 * ledger route (Phase 8) consumes it. Billing-owner/admin only server-side —
 * a member hits `403`, surfaced here as `isError` (the friendly access-denied
 * state is Phase 8's concern).
 *
 * `billing_period_start` defaults to the current open period when omitted; an
 * `organization` outside the caller's pooled subtree is a validation error,
 * not an empty result.
 */

import { useQuery } from '@tanstack/react-query';
import { billingUsageOccurrencesListOptions } from '@/client/@tanstack/react-query.gen';
import type {
  MeteredOccurrence,
  BillingUsageOccurrencesListData,
} from '@/client';

// The `_id` the generated factory tags every billingUsageOccurrencesList
// query key with.
export const OCCURRENCE_LEDGER_OPERATION_ID = 'billingUsageOccurrencesList';

export function useOccurrenceLedger({
  filters,
  enabled = true,
}: {
  /**
   * Ledger filters: `billing_period_start`, `is_within_allowance`,
   * `organization`, `occurrence_start_after` / `occurrence_start_before`,
   * `ordering`, and `limit` / `offset` pagination (max 1000).
   */
  filters?: BillingUsageOccurrencesListData['query'];
  enabled?: boolean;
} = {}) {
  const ledgerQuery = useQuery({
    ...billingUsageOccurrencesListOptions({ query: filters }),
    enabled,
  });

  const occurrences: MeteredOccurrence[] = ledgerQuery.data?.results ?? [];

  return {
    occurrences,
    totalCount: ledgerQuery.data?.count ?? 0,
    isLoading: ledgerQuery.isLoading,
    isError: ledgerQuery.isError,
    error: ledgerQuery.error,
    ledgerQuery,
  };
}
