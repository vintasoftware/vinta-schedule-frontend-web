/**
 * useUpdateBillingProfile — edit the org's billing profile / payer identity
 * (`PATCH /billing-profile/partial_update_billing_profile/`).
 *
 * Thin wrapper over the generated
 * `billingProfilePartialUpdateBillingProfilePartialUpdateMutation` factory
 * (canonical mutation-hook pattern — see use-change-plan.ts). PATCH (not PUT) is
 * used for edits so a partial body is a valid update; the billing-profile form
 * sends the full `PatchedBillingProfileWritable` regardless.
 *
 * On success the billing-profile read is invalidated so the form refetches the
 * updated profile — invalidation is by the read's operation `_id` predicate so
 * it matches every query variant (mirrors use-create-billing-profile).
 *
 * The generated factory uses `throwOnError:true`, so a non-2xx throws the parsed
 * body to the caller.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingProfilePartialUpdateBillingProfilePartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import type { BillingProfile, PatchedBillingProfileWritable } from '@/client';
import { BILLING_PROFILE_OPERATION_ID } from './use-billing-profile';

/** True for a query key tagged with the billing-profile read `_id`. */
function isBillingProfileKey(queryKey: unknown): boolean {
  if (!Array.isArray(queryKey)) {
    return false;
  }
  const id = (queryKey[0] as { _id?: string } | undefined)?._id;
  return id === BILLING_PROFILE_OPERATION_ID;
}

export function useUpdateBillingProfile() {
  const queryClient = useQueryClient();

  const updateBillingProfileMutation = useMutation({
    ...billingProfilePartialUpdateBillingProfilePartialUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => isBillingProfileKey(q.queryKey),
      });
    },
  });

  const updateBillingProfile = async (
    body: PatchedBillingProfileWritable
  ): Promise<BillingProfile> =>
    updateBillingProfileMutation.mutateAsync({ body });

  return { updateBillingProfile, updateBillingProfileMutation };
}
