'use client';

/**
 * AppBillingBanner — org-wide mount of `BillingStateBanner` in the app shell
 * (Phase 3, billing-hardening-gap-closure). Rendered once above `{children}`
 * in `AppLayoutClient`, so a GRACE/RESTRICTED/CANCELLED org sees it on every
 * authenticated page, not only inside `/billing`.
 *
 * `BillingStateBanner` itself is presentational and renders something for
 * every state (including a success "Active" alert) — so this wrapper decides
 * WHETHER to show it. Every non-`free`/`active` state surfaces app-wide when
 * a subscription exists:
 *   • grace      — informational, with the grace deadline + resolve link.
 *   • restricted — prominent (destructive), same resolve link.
 *   • cancelled  — warning, noting the period-end fallback to free.
 * `free`/`active` and a null/no-subscription org render nothing.
 *
 * Reads `useSubscription()` directly (not `useBillingUsage()`): a free/no-sub
 * org 404s there, which resolves to `subscription: null` — never thrown, so
 * this never blocks the shell it's mounted in.
 */

import { useSubscription } from '@/hooks/billing/use-subscription';
import { BillingStateBanner } from './billing-state-banner';

const BANNER_STATES = new Set(['grace', 'restricted', 'cancelled']);

export function AppBillingBanner() {
  const { subscription } = useSubscription();

  if (!subscription || !BANNER_STATES.has(subscription.billing_state)) {
    return null;
  }

  return (
    <BillingStateBanner
      billingState={subscription.billing_state}
      gracePeriodEndsAt={subscription.grace_period_ends_at}
    />
  );
}
