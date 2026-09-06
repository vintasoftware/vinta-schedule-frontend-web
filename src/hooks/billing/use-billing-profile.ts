/**
 * useBillingProfile — the organization's billing profile / payer identity
 * (`GET /billing-profile/`).
 *
 * Thin wrapper over the generated
 * `billingProfileRetrieveBillingProfileRetrieveOptions` factory (canonical
 * hook pattern — see use-appointment-type-scoped-quota.ts). Read-only in Phase 0; the
 * create/update mutations (Phase 6) invalidate this key.
 */

import { useQuery } from '@tanstack/react-query';
import { billingProfileRetrieveBillingProfileRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import type { BillingProfile } from '@/client';

// The `_id` the generated factory tags every
// billingProfileRetrieveBillingProfileRetrieve query key with.
export const BILLING_PROFILE_OPERATION_ID =
  'billingProfileRetrieveBillingProfileRetrieve';

export function useBillingProfile({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const billingProfileQuery = useQuery({
    ...billingProfileRetrieveBillingProfileRetrieveOptions(),
    enabled,
  });

  const billingProfile: BillingProfile | null =
    billingProfileQuery.data ?? null;

  return {
    billingProfile,
    isLoading: billingProfileQuery.isLoading,
    isError: billingProfileQuery.isError,
    error: billingProfileQuery.error,
    billingProfileQuery,
  };
}
