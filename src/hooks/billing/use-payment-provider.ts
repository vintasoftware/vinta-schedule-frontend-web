/**
 * usePaymentProvider — the deployment's resolved payment provider plus its
 * browser-safe public credentials (`GET /billing/payment-provider/`).
 *
 * Thin wrapper over the generated `billingPaymentProviderRetrieveOptions`
 * factory (canonical hook pattern — see use-appointment-type-scoped-quota.ts). Read-only
 * in Phase 0; Phase 1's PaymentInstrumentField consumes it to load the right
 * provider SDK.
 *
 * The endpoint answers `409` when no provider is configured in this
 * deployment; the generated factory throws on non-2xx, so that surfaces as
 * `isError` here — the "payments unavailable" branch is Phase 1's concern.
 */

import { useQuery } from '@tanstack/react-query';
import { billingPaymentProviderRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import type { PaymentProvider } from '@/client';

// The `_id` the generated factory tags every billingPaymentProviderRetrieve
// query key with.
export const PAYMENT_PROVIDER_OPERATION_ID = 'billingPaymentProviderRetrieve';

export function usePaymentProvider({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const paymentProviderQuery = useQuery({
    ...billingPaymentProviderRetrieveOptions(),
    enabled,
  });

  const paymentProvider: PaymentProvider | null =
    paymentProviderQuery.data ?? null;

  return {
    paymentProvider,
    isLoading: paymentProviderQuery.isLoading,
    isError: paymentProviderQuery.isError,
    error: paymentProviderQuery.error,
    paymentProviderQuery,
  };
}
