/**
 * useCancelAddOn — stop a recurring add-on from renewing at period end
 * (`DELETE /billing/add-ons/{id}/`).
 *
 * Thin wrapper over the generated `billingAddOnsDestroyMutation` factory
 * (canonical mutation-hook pattern — see use-cancel-subscription.ts). The path
 * carries the add-on id; the API returns the (now non-renewing)
 * `SubscriptionAddOn`. The add-on keeps its granted capacity through the current
 * period and simply does not renew — this is a "stop renewing", not an immediate
 * revocation.
 *
 * On success both the subscription AND usage reads are invalidated: the
 * subscription's `add_ons[]` row changes and the effective limits shift at
 * period end, so the overview dashboard must refetch. Invalidation is by the
 * operation `_id` predicate (mirrors use-cancel-subscription / use-change-plan).
 *
 * The generated factory uses `throwOnError:true`, so a non-2xx (e.g. a `404`
 * for an add-on outside the org's pool) throws the parsed body to the caller.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingAddOnsDestroyMutation } from '@/client/@tanstack/react-query.gen';
import type { SubscriptionAddOn } from '@/client';
import { SUBSCRIPTION_OPERATION_ID } from './use-subscription';
import { BILLING_USAGE_OPERATION_ID } from './use-billing-usage';

/** True for a query key tagged with either the subscription or usage `_id`. */
function isSubscriptionOrUsageKey(queryKey: unknown): boolean {
  if (!Array.isArray(queryKey)) {
    return false;
  }
  const id = (queryKey[0] as { _id?: string } | undefined)?._id;
  return id === SUBSCRIPTION_OPERATION_ID || id === BILLING_USAGE_OPERATION_ID;
}

export function useCancelAddOn() {
  const queryClient = useQueryClient();

  const cancelAddOnMutation = useMutation({
    ...billingAddOnsDestroyMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => isSubscriptionOrUsageKey(q.queryKey),
      });
    },
  });

  // The DELETE path is typed as a string id; `SubscriptionAddOn.id` is a number,
  // so we stringify it at the boundary.
  const cancelAddOn = async (id: number): Promise<SubscriptionAddOn> =>
    cancelAddOnMutation.mutateAsync({ path: { id: String(id) } });

  return { cancelAddOn, cancelAddOnMutation };
}
