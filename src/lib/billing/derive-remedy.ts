/**
 * derive-remedy.ts — client-derived remedy for an over-limit (`limit_exceeded`)
 * rejection (Phase 8, billing-hardening-gap-closure plan). The hardened
 * contract carries no `remedy` field (plan section 3.3), so the frontend
 * computes one from `resource` + `billing_state` + whether the resource can
 * be bought as an add-on, via this documented default table:
 *
 *   billing_state is 'grace' | 'restricted'  → 'resolve_billing'
 *   else isAddOnPurchasable(resource)         → 'purchase_add_on'
 *   else                                       → 'upgrade_plan'
 *
 * `add_payment_method` is never derived by `deriveRemedy` — it is reached via
 * `payment_token_required` on the TARGET flow itself (see
 * `isPaymentTokenRequiredError` in `@/lib/utils/api-errors`), not from an
 * over-limit rejection. It still exists in the `Remedy` union so
 * `remedyToRoute` has one destination table for every remedy the app can
 * reach, from wherever it's reached.
 *
 * This mapping is a frontend heuristic (plan's Open Questions #1), not a
 * server truth — retuning it means editing this one table, no backend change.
 */

import type { BillingStateEnum } from '@/client';
import { billingUpgradePath } from '@/lib/utils/api-errors';

export type Remedy =
  | 'purchase_add_on'
  | 'upgrade_plan'
  | 'add_payment_method'
  | 'resolve_billing';

export interface RemedyRoute {
  remedy: Remedy;
  href: string;
  resource?: string;
}

/**
 * Derives the remedy for an over-limit rejection. `billingState` may be
 * `null`/`undefined` when the subscription cache hasn't warmed yet (or the
 * org has none — a free org) — treated the same as any non-grace/restricted
 * state, falling through to the add-on/upgrade branches.
 */
export function deriveRemedy(
  resource: string,
  billingState: BillingStateEnum | null | undefined,
  isAddOnPurchasable: (resource: string) => boolean
): Remedy {
  if (billingState === 'grace' || billingState === 'restricted') {
    return 'resolve_billing';
  }
  if (isAddOnPurchasable(resource)) {
    return 'purchase_add_on';
  }
  return 'upgrade_plan';
}

/**
 * Maps a derived remedy to its destination. `purchase_add_on` has no
 * dedicated route — the remedy router (`remedy-router.tsx`) opens
 * `PurchaseAddOnDialog` in place instead of navigating; the `href` returned
 * here is a sane fallback for any caller that only wants a link (e.g. a
 * server-rendered notice). `add_payment_method` similarly has no single
 * target route from this table alone — it's reached from the specific flow
 * that raised `payment_token_required`, not routed here — so it also falls
 * back to the general billing surface.
 *
 * An unrecognized `remedy` (a value outside the `Remedy` union — defensive
 * only, since every producer in this codebase is typed) falls back to the
 * same generic "manage billing" destination rather than routing nowhere.
 */
export function remedyToRoute(remedy: Remedy, resource?: string): RemedyRoute {
  if (remedy === 'upgrade_plan') {
    return { remedy, href: billingUpgradePath(resource), resource };
  }
  if (remedy === 'resolve_billing') {
    return { remedy, href: '/billing/resolve-payment', resource };
  }
  if (remedy === 'purchase_add_on') {
    return { remedy, href: '/billing', resource };
  }
  if (remedy === 'add_payment_method') {
    return { remedy, href: '/billing', resource };
  }
  // Unrecognized remedy — generic fallback (see doc comment above).
  return { remedy, href: '/billing', resource };
}
