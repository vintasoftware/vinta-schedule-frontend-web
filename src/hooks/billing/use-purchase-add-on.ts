/**
 * usePurchaseAddOn — buy additional capacity for a pre-paid resource
 * (`POST /billing/add-ons/`).
 *
 * Thin wrapper over the generated `billingAddOnsCreateMutation` factory
 * (canonical mutation-hook pattern — see use-change-plan.ts). The body is the
 * `AddOnPurchaseRequest`: `{ resource_key, quantity, is_recurring?,
 * idempotency_key, payment_token? }`. The caller owns the `idempotency_key` (one
 * per user attempt, reused across retries — `createIdempotencyKeyHolder`) and
 * the `payment_token` (minted by `PaymentInstrumentField`), so a network retry
 * or a double-click never double-charges.
 *
 * The endpoint answers `201` with the new `SubscriptionAddOn` BEFORE the charge
 * confirms — capacity/`is_active` flips on the provider webhook. So on success
 * both the subscription AND usage reads are invalidated: the subscription's
 * `add_ons[]` gains the row and the effective limits rise once the webhook
 * lands, so the overview dashboard must refetch. Invalidation is by the
 * operation `_id` predicate (mirrors use-change-plan / use-update-member-role).
 *
 * The generated factory uses `throwOnError:true`, so a `400`
 * (`AddOnNotPurchasableError`) or `409` (provider unconfigured) throws the
 * parsed body to the caller, which branches on it via the
 * `@/lib/utils/api-errors` readers.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingAddOnsCreateMutation } from '@/client/@tanstack/react-query.gen';
import type { AddOnPurchaseRequest, SubscriptionAddOn } from '@/client';
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

export function usePurchaseAddOn() {
  const queryClient = useQueryClient();

  const purchaseAddOnMutation = useMutation({
    ...billingAddOnsCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => isSubscriptionOrUsageKey(q.queryKey),
      });
    },
  });

  const purchaseAddOn = async (
    body: AddOnPurchaseRequest
  ): Promise<SubscriptionAddOn> => purchaseAddOnMutation.mutateAsync({ body });

  return { purchaseAddOn, purchaseAddOnMutation };
}
