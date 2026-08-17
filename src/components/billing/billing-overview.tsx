'use client';

/**
 * BillingOverview — the current-usage dashboard client island the `/billing`
 * page renders (Phase 2). The page itself stays a Server Component; this
 * component is the client boundary that calls the read hooks and composes the
 * presentational billing components.
 *
 * It reads `GET /billing/usage/` (`useBillingUsage`) for everything on screen —
 * billing state, plan snapshot, period bounds, per-resource usage, reseller
 * attribution, accrued overage — and `GET /billing/subscription/`
 * (`useSubscription`) as a supporting read for the plan summary card and the
 * purchase dialog. A free / no-sub org answers `404` there, which is expected
 * and never blocks the dashboard.
 *
 * The GRACE/RESTRICTED billing-state banner does NOT mount here — it mounts
 * app-wide in `AppLayoutClient` (Phase 3, `app-billing-banner.tsx`) so it
 * appears on every authenticated page, not only `/billing`.
 *
 * States:
 *   • Loading — the usage query is in flight.
 *   • Error — the usage read errored (a `403` for no active organization or a
 *     member without billing read access, but also a transient 500/network
 *     blip): a friendly, neutral alert, never a crash. The generated client
 *     throws only the response body — no status code — so we can't cheaply tell
 *     a genuine access denial from a transient failure, hence the copy asserts
 *     no cause.
 *   • Rendered — the full dashboard. The free / subscription-less path
 *     (`billing_state: "free"`, null plan/period, unlimited rows,
 *     `estimated_overage_total: "0.0000"`) renders cleanly through the same
 *     composition — the presentational components handle the null/unlimited
 *     shapes.
 */

import * as React from 'react';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import {
  Center,
  Grid,
  Stack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';

import type { ResourceKeyEnum } from '@/client';
import { useBillingUsage } from '@/hooks/billing/use-billing-usage';
import { useSubscription } from '@/hooks/billing/use-subscription';
import {
  useHasPermission,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';

import { ActiveAddOnsList } from './active-add-ons-list';
import { OverageEstimate } from './overage-estimate';
import { PlanSummaryCard } from './plan-summary-card';
import { PurchaseAddOnDialog } from './purchase-add-on-dialog';
import { ResourceUsageList } from './resource-usage-list';

export function BillingOverview() {
  const { usage, isLoading, isError } = useBillingUsage();
  // Supporting read: the subscription feeds the plan summary card (interval,
  // pending change) and the purchase dialog. A free/no-sub org answers 404
  // here, so this never gates the dashboard.
  const { subscription } = useSubscription();
  // Role gating is defense-in-depth: only an admin gets the "Buy more"
  // affordance; the server `403` on the purchase endpoint is the real gate.
  const canManageBilling = useHasPermission(PERMISSIONS.manageBilling);

  // The resource a "Buy more" click targets — drives the pre-selected purchase
  // dialog. `null` when closed; the dialog unmounts on close (and remounts with
  // a fresh idempotency holder next open), so each attempt is a clean instance.
  const [buyMoreResource, setBuyMoreResource] =
    React.useState<ResourceKeyEnum | null>(null);

  if (isLoading) {
    return (
      <Center grow>
        <Text color='muted-foreground'>Loading billing…</Text>
      </Center>
    );
  }

  if (isError || usage === null) {
    return (
      <Alert data-testid='billing-access-denied'>
        <AlertTitle>Couldn&apos;t load billing</AlertTitle>
        <AlertDescription>
          We couldn&apos;t load your billing information right now. Please try
          again in a moment.
        </AlertDescription>
      </Alert>
    );
  }

  const currency = usage.plan?.currency ?? null;

  return (
    <Stack gap={6}>
      {/* Billing-state banner (grace/restricted) now mounts app-wide in
          AppLayoutClient (Phase 3) so it appears on every authenticated page,
          not only here — rendering it again in-section would double it up
          on /billing. */}

      {/* Column count reacts to the CONTENT container's width
          (@container/content on the AppShell main), not the viewport —
          collapsing the sidebar widens the container and the grid reflows off
          that. Mirrors the dashboard tile grid. */}
      <Grid columns={{ base: 1, '@xl/content': 2 }} gap={4} align='start'>
        <PlanSummaryCard
          plan={usage.plan}
          billingPeriod={usage.billing_period}
          subscription={subscription}
        />
        <OverageEstimate
          estimatedOverageTotal={usage.estimated_overage_total}
          currency={currency}
        />
      </Grid>

      <VStack gap={3} align='stretch'>
        <Text weight='semibold'>Resource usage</Text>
        <ResourceUsageList
          limits={usage.limits}
          currency={currency}
          onBuyMore={
            canManageBilling
              ? (resourceKey) =>
                  setBuyMoreResource(resourceKey as ResourceKeyEnum)
              : undefined
          }
        />
      </VStack>

      <ActiveAddOnsList />

      {buyMoreResource !== null && (
        <PurchaseAddOnDialog
          // Per-attempt identity: a fresh mount (fresh idempotency holder +
          // phase + card field) each time the dialog opens for a resource, so a
          // distinct purchase can never reuse a previous attempt's key.
          key={buyMoreResource}
          open
          onOpenChange={(open) => {
            if (!open) setBuyMoreResource(null);
          }}
          resourceKey={buyMoreResource}
          subscription={subscription}
        />
      )}
    </Stack>
  );
}
