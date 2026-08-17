/**
 * useUpdateBillingProfile — edit the org's billing profile / payer identity
 * (`PATCH /billing-profile/partial_update_billing_profile/`).
 *
 * Calls the raw generated `billingProfilePartialUpdateBillingProfilePartialUpdate`
 * operation with `throwOnError:false` (rather than spreading the generated
 * `billingProfilePartialUpdateBillingProfilePartialUpdateMutation` factory,
 * which hardcodes `throwOnError:true` and throws only the parsed body — no HTTP
 * status). The form needs the status to tell a defensive 403 apart from a
 * 409-already-exists conflict without matching English `detail` text (Phase 4
 * hardening) — see `use-current-organization.ts` for the same raw-operation
 * pattern applied to a query. On a non-2xx response the parsed error body is
 * thrown with a numeric `status` property attached
 * (`readBillingConflict`/`readFieldValidationErrors` ignore the extra key;
 * `readErrorStatus` reads it). PATCH (not PUT) is used for edits so a partial
 * body is a valid update; the billing-profile form sends the full
 * `PatchedBillingProfileWritable` regardless.
 *
 * On success the billing-profile read is invalidated so the form refetches the
 * updated profile — invalidation is by the read's operation `_id` predicate so
 * it matches every query variant (mirrors use-create-billing-profile).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingProfilePartialUpdateBillingProfilePartialUpdate } from '@/client';
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
    mutationFn: async ({
      body,
    }: {
      body: PatchedBillingProfileWritable;
    }): Promise<BillingProfile> => {
      const { data, error, response } =
        await billingProfilePartialUpdateBillingProfilePartialUpdate({
          body,
          throwOnError: false,
        });
      if (!response) {
        throw new Error('Failed to update billing profile (no response)');
      }
      if (response.ok && data) {
        return data;
      }
      throw Object.assign(error && typeof error === 'object' ? error : {}, {
        status: response.status,
      });
    },
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
