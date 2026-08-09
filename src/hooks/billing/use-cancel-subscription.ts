/**
 * useCancelSubscription — cancel the org's subscription
 * (`POST /billing/subscription/cancel/`, no body).
 *
 * Thin wrapper over the generated `billingSubscriptionCancelCreateMutation`
 * factory (canonical mutation-hook pattern — see use-change-requests.ts). The
 * plan runs to the end of the current period, then the org falls back to free —
 * the API returns the (now cancelling) `Subscription`.
 *
 * On success both the subscription AND usage reads are invalidated: the
 * subscription's state flips to `cancelled` and the effective limits change at
 * period end, so the overview dashboard must refetch. Invalidation is by the
 * operation `_id` predicate (mirrors use-change-plan / use-update-member-role).
 *
 * The generated factory uses `throwOnError:true`, so a `409` (the stamped
 * provider is unconfigured, so the provider-side cancellation can't be driven)
 * throws the parsed body to the caller.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingSubscriptionCancelCreateMutation } from '@/client/@tanstack/react-query.gen';
import type { Subscription } from '@/client';
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

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  const cancelSubscriptionMutation = useMutation({
    ...billingSubscriptionCancelCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => isSubscriptionOrUsageKey(q.queryKey),
      });
    },
  });

  const cancelSubscription = async (): Promise<Subscription> =>
    cancelSubscriptionMutation.mutateAsync({});

  return { cancelSubscription, cancelSubscriptionMutation };
}
