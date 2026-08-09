/**
 * OverageEstimate — the overage money accrued so far this cycle
 * (`estimated_overage_total` from `GET /billing/usage/`).
 *
 * The number is explicitly labeled "accrued so far this cycle" — it is the
 * accrued-to-date total, NOT a projection of the whole period (matching the
 * API's `estimated_overage_total` semantics and the plan's Non-goals: no
 * forecasts). It is formatted with `formatMoney` in the plan's currency.
 *
 * When there is no subscription there is no currency and no money to format, so
 * the amount renders as an em dash rather than an unformatted decimal string.
 *
 * Presentational: renders from props only, so it stays a Server Component.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import { Text } from 'vinta-schedule-design-system/layout';

import { formatMoney } from '@/lib/billing/format';

export interface OverageEstimateProps {
  /** The Decimal-string `estimated_overage_total` from the usage payload. */
  estimatedOverageTotal: string;
  /**
   * The plan's currency. `null` for a free / subscription-less org — there is
   * no money to format, so the amount renders as "—".
   */
  currency: string | null;
}

export function OverageEstimate({
  estimatedOverageTotal,
  currency,
}: OverageEstimateProps) {
  const amount =
    currency !== null ? formatMoney(estimatedOverageTotal, currency) : '—';

  return (
    <Card data-testid='overage-estimate'>
      <CardHeader>
        <CardTitle>Overage</CardTitle>
        <CardDescription>Accrued so far this cycle</CardDescription>
      </CardHeader>
      <CardContent>
        <Text size='2xl' weight='semibold' data-testid='overage-amount'>
          {amount}
        </Text>
      </CardContent>
    </Card>
  );
}
