/**
 * useChangePlan — upgrade/downgrade the org's plan
 * (`POST /billing/subscription/change-plan/`).
 *
 * Thin wrapper over the generated `billingSubscriptionChangePlanCreateMutation`
 * factory (canonical mutation-hook pattern — see use-change-requests.ts). The
 * body is the `ChangePlanRequest`: `{ plan_slug, billing_interval?,
 * idempotency_key, payment_token? }`. The caller owns the `idempotency_key` (one
 * per user attempt, reused across retries — `createIdempotencyKeyHolder`) and
 * the `payment_token` (minted by `PaymentInstrumentField`), so a network retry
 * or a 400-then-retry never double-charges.
 *
 * On success both the subscription AND usage reads are invalidated: change-plan
 * returns a subscription with `pending_*` set (the webhook clears it later) and
 * the effective limits move once the new plan lands, so the overview dashboard
 * must refetch. Invalidation is by the operation `_id` predicate so it matches
 * every query variant without re-deriving each key (mirrors use-update-member-role).
 *
 * The generated factory uses `throwOnError:true`, so a `400`
 * (`PaymentTokenRequiredError`), `402` (over-limit downgrade) or `409` (a change
 * already awaiting confirmation / provider unconfigured) throws the parsed body
 * to the caller, which branches on it via the `@/lib/utils/api-errors` readers.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingSubscriptionChangePlanCreateMutation } from '@/client/@tanstack/react-query.gen';
import type { ChangePlanRequest, Subscription } from '@/client';
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

export function useChangePlan() {
  const queryClient = useQueryClient();

  const changePlanMutation = useMutation({
    ...billingSubscriptionChangePlanCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => isSubscriptionOrUsageKey(q.queryKey),
      });
    },
    // change-plan-dialog.tsx renders an inline error for `readOverLimitError`
    // (downgrade below usage) — opt out of the global MutationCache.onError
    // remedy routing (query-client-provider.tsx, Phase 8) so the same rejection
    // is never both shown inline AND routed away with a disruptive navigation.
    meta: { overLimitHandledInline: true },
  });

  const changePlan = async (body: ChangePlanRequest): Promise<Subscription> =>
    changePlanMutation.mutateAsync({ body });

  return { changePlan, changePlanMutation };
}
