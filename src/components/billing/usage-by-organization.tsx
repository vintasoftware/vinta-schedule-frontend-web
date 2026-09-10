/**
 * UsageByOrganization — the reseller attribution breakdown for one resource
 * (`EffectiveLimitUsage.by_scope`).
 *
 * The enriched usage response carries, per resource, which organizations in the
 * caller's pooled billing subtree consumed capacity. This renders that split so
 * a reseller root sees which child drove usage. It is attribution, not a
 * scope-down control (the API does not support scoping in v1 — Guiding
 * Decision).
 *
 * Each entry is keyed by `scope_id` — the billing scope that pays, which is a
 * different sequence from the organization id — while `name` is still the
 * organization's own name. So the rows key on scope and read as organizations.
 *
 * It renders ONLY when the pool has more than one contributing organization:
 * for a single-org pool the breakdown is just the org's own total, already
 * shown by the row, so this returns null to avoid noise.
 *
 * Presentational: renders from props only, so it stays a Server Component.
 */

import {
  Divider,
  HStack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';

import type { UsageByScope as UsageByScopeRow } from '@/client';

export interface UsageByOrganizationProps {
  /**
   * Per-organization attribution for this resource, contributors only, ordered
   * by scope id ascending (the API's contract).
   */
  byScope: UsageByScopeRow[];
  /** The resource's display label, for the section heading. */
  resourceLabel: string;
}

export function UsageByOrganization({
  byScope,
  resourceLabel,
}: UsageByOrganizationProps) {
  // Single-org pools hide the breakdown — the row's own total already says it.
  if (byScope.length <= 1) {
    return null;
  }

  return (
    <VStack gap={2} align='stretch' data-testid='usage-by-organization'>
      <Divider />
      <Text size='xs' color='muted-foreground' uppercase>
        {resourceLabel} usage by organization
      </Text>
      <VStack gap={1} align='stretch'>
        {byScope.map((org) => (
          <HStack key={org.scope_id} justify='between' gap={4}>
            <Text size='sm' truncate>
              {org.name}
            </Text>
            <Text size='sm' weight='medium'>
              {org.usage}
            </Text>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}
