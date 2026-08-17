/**
 * entitlement-labels.ts — human-facing labels for the machine
 * `entitlement_key`s a `BillingPlan` carries (`PlanEntitlement.entitlement_key`,
 * the `EntitlementKeyEnum`).
 *
 * Mirrors `resource-labels.ts`: the plan picker renders these keys, so the
 * mapping lives here once. An unmapped key (an entitlement the API adds before
 * this map is updated) falls back to a humanized form of the raw slug.
 */

import type { EntitlementKeyEnum } from '@/client';

export const ENTITLEMENT_LABELS: Record<EntitlementKeyEnum, string> = {
  external_calendar_google: 'Google Calendar sync',
  external_calendar_microsoft: 'Microsoft Calendar sync',
  partner_api: 'Partner API access',
  white_label_branding: 'White-label branding',
  advanced_scheduling: 'Advanced scheduling',
};

/**
 * Resolves an entitlement key to its display label. Accepts a plain `string`
 * (mirrors `resourceLabel`'s loose typing) and falls back to a humanized
 * slug — underscores to spaces, first letter capitalized — for any key not in
 * the map above.
 */
export function entitlementLabel(entitlementKey: string): string {
  const known = ENTITLEMENT_LABELS[entitlementKey as EntitlementKeyEnum];
  if (known) {
    return known;
  }
  const humanized = entitlementKey.replace(/_/g, ' ');
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}
