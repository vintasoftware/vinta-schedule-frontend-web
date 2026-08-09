/**
 * useCreateBillingProfile — create the org's billing profile / payer identity
 * (`POST /billing-profile/create_billing_profile/`).
 *
 * Thin wrapper over the generated
 * `billingProfileCreateBillingProfileCreateMutation` factory (canonical
 * mutation-hook pattern — see use-change-plan.ts). The body is the full
 * `BillingProfileWritable` (tax + payer identity + nested billing address).
 *
 * On success the billing-profile read is invalidated so the form (and any other
 * consumer) refetches the now-existing profile — invalidation is by the read's
 * operation `_id` predicate so it matches every query variant without
 * re-deriving the key (mirrors use-change-plan / use-cancel-add-on).
 *
 * The generated factory uses `throwOnError:true`, so a non-2xx (notably a `409`
 * when a profile already exists — someone else created it meanwhile) throws the
 * parsed body to the caller, which branches on it via `readBillingConflict`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingProfileCreateBillingProfileCreateMutation } from '@/client/@tanstack/react-query.gen';
import type { BillingProfile, BillingProfileWritable } from '@/client';
import { BILLING_PROFILE_OPERATION_ID } from './use-billing-profile';

/** True for a query key tagged with the billing-profile read `_id`. */
function isBillingProfileKey(queryKey: unknown): boolean {
  if (!Array.isArray(queryKey)) {
    return false;
  }
  const id = (queryKey[0] as { _id?: string } | undefined)?._id;
  return id === BILLING_PROFILE_OPERATION_ID;
}

export function useCreateBillingProfile() {
  const queryClient = useQueryClient();

  const createBillingProfileMutation = useMutation({
    ...billingProfileCreateBillingProfileCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => isBillingProfileKey(q.queryKey),
      });
    },
  });

  const createBillingProfile = async (
    body: BillingProfileWritable
  ): Promise<BillingProfile> =>
    createBillingProfileMutation.mutateAsync({ body });

  return { createBillingProfile, createBillingProfileMutation };
}
