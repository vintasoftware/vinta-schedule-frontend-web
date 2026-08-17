'use client';

/**
 * RemedyRouter — the acting half of the global over-limit handler (Phase 8,
 * billing-hardening-gap-closure plan). The shared `QueryClient`'s
 * `MutationCache.onError` (query-client-provider.tsx) derives a remedy for
 * every `limit_exceeded` rejection it doesn't skip and EMITS it on the remedy
 * bus (`@/lib/billing/remedy-bus`) — it has no router or component tree to
 * act from. `RemedyRouter` is mounted once, app-wide (`app-layout-client.tsx`,
 * inside the authenticated shell), subscribes to that bus, and performs the
 * actual action:
 *
 *   - `purchase_add_on` → opens `PurchaseAddOnDialog` pre-filled with the
 *     resource, IN PLACE. Buying an add-on is a quick unblock; sending the
 *     user away from what they were doing would be more disruptive than the
 *     rejection itself.
 *   - every other remedy (`upgrade_plan`, `resolve_billing`,
 *     `add_payment_method`, and any unrecognized value) → navigates via
 *     `remedyToRoute`'s destination, `router.push`. An unrecognized remedy
 *     resolves to the generic `/billing` fallback baked into `remedyToRoute`,
 *     so this component never has to special-case "unknown" itself.
 *
 * Resilient by construction: whatever remedy arrives, SOME action fires — a
 * dialog opens or a navigation happens. There is no state where the routing
 * silently does nothing.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import type { ResourceKeyEnum } from '@/client';
import { subscribeToRemedy } from '@/lib/billing/remedy-bus';
import { remedyToRoute } from '@/lib/billing/derive-remedy';
import { useSubscription } from '@/hooks/billing/use-subscription';

import { PurchaseAddOnDialog } from './purchase-add-on-dialog';

export function RemedyRouter() {
  const router = useRouter();
  // Feeds PurchaseAddOnDialog's `hasPaidInstrument` check — same read the
  // billing overview's own "Buy more" entry point uses.
  const { subscription } = useSubscription();

  // The resource a routed `purchase_add_on` remedy targets. `null` when no
  // dialog should be open. Keyed by resource on mount (below) so a distinct
  // over-limit rejection always gets a fresh dialog instance — same
  // convention as billing-overview.tsx's `buyMoreResource`.
  const [addOnResource, setAddOnResource] =
    React.useState<ResourceKeyEnum | null>(null);

  React.useEffect(
    () =>
      subscribeToRemedy((event) => {
        if (event.remedy === 'purchase_add_on') {
          setAddOnResource(event.resource as ResourceKeyEnum);
          return;
        }
        const { href } = remedyToRoute(event.remedy, event.resource);
        router.push(href);
      }),
    [router]
  );

  return (
    <>
      {addOnResource !== null && (
        <PurchaseAddOnDialog
          // Per-attempt identity: a fresh mount (fresh idempotency holder) for
          // each resource a rejection routes to — mirrors billing-overview.tsx.
          key={addOnResource}
          open
          onOpenChange={(open) => {
            if (!open) setAddOnResource(null);
          }}
          resourceKey={addOnResource}
          subscription={subscription}
        />
      )}
    </>
  );
}
