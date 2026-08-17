/**
 * useCreateBillingProfile — create the org's billing profile / payer identity
 * (`POST /billing-profile/create_billing_profile/`).
 *
 * Calls the raw generated `billingProfileCreateBillingProfileCreate` operation
 * with `throwOnError:false` (rather than spreading the generated
 * `billingProfileCreateBillingProfileCreateMutation` factory, which hardcodes
 * `throwOnError:true` and throws only the parsed body — no HTTP status). The
 * form needs the status to tell a defensive 403 apart from a 409-already-exists
 * conflict without matching English `detail` text (Phase 4 hardening) — see
 * `use-current-organization.ts` for the same raw-operation pattern applied to a
 * query. On a non-2xx response the parsed error body is thrown with a numeric
 * `status` property attached (`readBillingConflict`/`readFieldValidationErrors`
 * ignore the extra key; `readErrorStatus` reads it).
 *
 * On success the billing-profile read is invalidated so the form (and any other
 * consumer) refetches the now-existing profile — invalidation is by the read's
 * operation `_id` predicate so it matches every query variant without
 * re-deriving the key (mirrors use-change-plan / use-cancel-add-on).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingProfileCreateBillingProfileCreate } from '@/client';
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
    mutationFn: async ({
      body,
    }: {
      body: BillingProfileWritable;
    }): Promise<BillingProfile> => {
      const { data, error, response } =
        await billingProfileCreateBillingProfileCreate({
          body,
          throwOnError: false,
        });
      if (!response) {
        throw new Error('Failed to create billing profile (no response)');
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

  const createBillingProfile = async (
    body: BillingProfileWritable
  ): Promise<BillingProfile> =>
    createBillingProfileMutation.mutateAsync({ body });

  return { createBillingProfile, createBillingProfileMutation };
}
