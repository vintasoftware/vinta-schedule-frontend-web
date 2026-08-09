/**
 * useSubscription — the organization's current subscription
 * (`GET /billing/subscription/`).
 *
 * Thin wrapper over the generated
 * `billingSubscriptionRetrieveSubscriptionRetrieveOptions` factory (canonical
 * hook pattern — see use-group-scoped-quota.ts). Read-only in Phase 0.
 *
 * The endpoint answers `404` when the org has no subscription; the generated
 * factory throws on non-2xx (throwOnError:true), so that surfaces here as
 * `isError`. Consumers that need to distinguish "no subscription" from a real
 * failure do so in their own phase — Phase 0 only wires the read.
 */

import { useQuery } from '@tanstack/react-query';
import { billingSubscriptionRetrieveSubscriptionRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import type { Subscription } from '@/client';

// The `_id` the generated factory tags every
// billingSubscriptionRetrieveSubscriptionRetrieve query key with.
export const SUBSCRIPTION_OPERATION_ID =
  'billingSubscriptionRetrieveSubscriptionRetrieve';

export function useSubscription({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const subscriptionQuery = useQuery({
    ...billingSubscriptionRetrieveSubscriptionRetrieveOptions(),
    enabled,
  });

  const subscription: Subscription | null = subscriptionQuery.data ?? null;

  return {
    subscription,
    isLoading: subscriptionQuery.isLoading,
    isError: subscriptionQuery.isError,
    error: subscriptionQuery.error,
    subscriptionQuery,
  };
}
