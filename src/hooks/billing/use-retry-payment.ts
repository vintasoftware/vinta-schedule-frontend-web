/**
 * useRetryPayment — recover a GRACE/RESTRICTED subscription by attaching a
 * fresh payment instrument and resubmitting the outstanding balance for
 * collection (`POST /billing/subscription/retry-payment/`).
 *
 * Thin wrapper over the generated `billingSubscriptionRetryPaymentCreateMutation`
 * factory (canonical mutation-hook pattern — see use-change-plan.ts). The body
 * is the `RetryPaymentRequest`: `{ idempotency_key, payment_token }` — both
 * required (unlike change-plan's optional `payment_token`, this endpoint exists
 * precisely to attach a NEW instrument). The caller owns the `idempotency_key`
 * (one per user attempt, reused across retries of that attempt — see
 * `createIdempotencyKeyHolder` — and reset ONLY when the previous attempt's
 * charge was declined, so a genuinely new card mints a fresh key) and the
 * `payment_token` (minted by `PaymentInstrumentField`).
 *
 * The 200 response is NOT success: recovery is webhook-driven, so the returned
 * subscription is still `grace`/`restricted` and only moves to `active` once
 * the subscription-payment webhook confirms the charge. Callers must poll
 * `useSubscription` for that transition rather than trusting this mutation's
 * resolution. We still invalidate the subscription read on success (by the
 * `_id` predicate, mirroring use-change-plan) so any cached read reflects the
 * `grace`/`restricted` response immediately instead of showing stale data
 * while the poll catches up.
 *
 * The generated factory uses `throwOnError:true`, so a `402` (`charge_declined`)
 * or `409` (one of four conflicts — see api-errors.ts) throws the parsed body
 * to the caller, which branches on it via the `@/lib/utils/api-errors` readers.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingSubscriptionRetryPaymentCreateMutation } from '@/client/@tanstack/react-query.gen';
import type { RetryPaymentRequest, Subscription } from '@/client';
import { SUBSCRIPTION_OPERATION_ID } from './use-subscription';

/** True for a query key tagged with the subscription read's `_id`. */
function isSubscriptionKey(queryKey: unknown): boolean {
  if (!Array.isArray(queryKey)) {
    return false;
  }
  const id = (queryKey[0] as { _id?: string } | undefined)?._id;
  return id === SUBSCRIPTION_OPERATION_ID;
}

export function useRetryPayment() {
  const queryClient = useQueryClient();

  const retryPaymentMutation = useMutation({
    ...billingSubscriptionRetryPaymentCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => isSubscriptionKey(q.queryKey),
      });
    },
    // resolve-payment-form.tsx renders an inline error for `readOverLimitError`
    // — opt out of the global MutationCache.onError remedy routing (query-
    // client-provider.tsx, Phase 8) so the same rejection is never both shown
    // inline AND routed away with a disruptive navigation or dialog.
    meta: { overLimitHandledInline: true },
  });

  const retryPayment = async (
    body: RetryPaymentRequest
  ): Promise<Subscription> => retryPaymentMutation.mutateAsync({ body });

  return { retryPayment, retryPaymentMutation };
}
