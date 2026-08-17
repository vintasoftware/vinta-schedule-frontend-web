/**
 * resource-labels.ts — human-facing labels for the machine `resource_key`s the
 * billing API meters (`EffectiveLimitUsage.resource_key`, the `ResourceKeyEnum`).
 *
 * The usage dashboard, add-on picker, and statement rows all render these keys,
 * so the mapping lives here once rather than being re-declared per surface. An
 * unmapped key (a resource the API adds before this map is updated) falls back
 * to a humanized form of the raw slug, so it still renders sensibly instead of
 * being dropped.
 */

import type { ResourceKeyEnum } from '@/client';

export const RESOURCE_LABELS: Record<ResourceKeyEnum, string> = {
  organization_members: 'Organization members',
  resource_calendars: 'Resource calendars',
  calendar_groups: 'Calendar groups',
  bundle_calendars: 'Bundle calendars',
  availability_windows: 'Availability windows',
  webhook_subscriptions: 'Webhook subscriptions',
  public_api_system_users: 'Public API users',
  event_occurrences: 'Event occurrences',
};

/**
 * Resolves a resource key to its display label. Accepts a plain `string` (the
 * usage payload types `resource_key` loosely) and falls back to a humanized
 * slug — underscores to spaces, first letter capitalized — for any key not in
 * the map above.
 */
export function resourceLabel(resourceKey: string): string {
  const known = RESOURCE_LABELS[resourceKey as ResourceKeyEnum];
  if (known) {
    return known;
  }
  const humanized = resourceKey.replace(/_/g, ' ');
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

/**
 * The resource keys currently offered as add-on purchases — every metered
 * resource key is offered today (`PurchaseAddOnDialog`'s default resource
 * options). Kept here, derived from `RESOURCE_LABELS` rather than
 * re-declared, so `purchase-add-on-dialog.tsx` and the global over-limit
 * handler (`query-client-provider.tsx`'s `isAddOnPurchasable`, Phase 8 of the
 * billing-hardening plan) branch off the exact same set instead of drifting.
 * Lives in this framework-free module — not the dialog component — so the
 * shared `QueryClient` (used app-wide, including on unauthenticated routes)
 * never has to import the dialog's UI code just to read this list.
 */
export const ADD_ON_PURCHASABLE_RESOURCE_KEYS = Object.keys(
  RESOURCE_LABELS
) as ResourceKeyEnum[];
