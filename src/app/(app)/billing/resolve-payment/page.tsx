'use client';

/**
 * ResolvePaymentPage — the GRACE / RESTRICTED payment-recovery route (Phase 5;
 * the recovery direction of Use-case 5). Reached from the Phase 2 billing-state
 * banner's "Resolve payment" link when `billing_state` is GRACE / RESTRICTED.
 *
 * A client route (it needs the subscription read + role signal + a redirect),
 * mirroring the branding page: it owns the data-load, the redirect guard, and
 * the admin gate, then renders the `ResolvePaymentForm` island — the money-path
 * form is the thing under test on its own.
 *
 * Guards:
 *   • NOTHING TO RESOLVE — if the org isn't in GRACE / RESTRICTED (it's active,
 *     free, cancelled, or has no subscription at all), there is nothing to
 *     recover, so we redirect to `/billing`. The redirect never targets this
 *     same route (no loop): `/billing` is the overview.
 *   • ADMIN-GATED — recovery re-initiates a charge, so only an admin sees the
 *     form; a non-admin gets a friendly access-denied state (the server `403`
 *     on change-plan is the real backstop). Role gating is defense-in-depth.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import { Center, Stack, Text } from 'vinta-schedule-design-system/layout';
import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';

import { ResolvePaymentForm } from '@/components/billing/resolve-payment-form';
import { useSubscription } from '@/hooks/billing/use-subscription';
import {
  usePermissions,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';

export default function ResolvePaymentPage() {
  const router = useRouter();
  const { subscription, isLoading } = useSubscription();
  const permissions = usePermissions();

  const billingState = subscription?.billing_state ?? null;
  const needsResolution =
    billingState === 'grace' || billingState === 'restricted';

  // Nothing to resolve once the read settles and the org isn't in a dunning
  // window — send them back to the overview. Guarded on `!isLoading` so a
  // mid-flight read never triggers a premature redirect.
  useEffect(() => {
    if (!isLoading && !needsResolution) {
      router.replace('/billing');
    }
  }, [isLoading, needsResolution, router]);

  if (isLoading) {
    return (
      <Center grow>
        <Text color='muted-foreground'>Loading…</Text>
      </Center>
    );
  }

  // Redirecting away (nothing to resolve). Render nothing rather than flash the
  // form or an access-denied state while the replace lands. The `subscription
  // === null` disjunct is runtime-redundant (a null subscription already yields
  // `needsResolution === false`) but load-bearing for the type system: it narrows
  // `subscription` to non-null for the `<ResolvePaymentForm>` render below.
  if (!needsResolution || subscription === null) {
    return null;
  }

  // Wait for the permission signal before deciding the gate — a null
  // (still-loading) permission set must not flash the access-denied state.
  if (permissions === null) {
    return (
      <Center grow>
        <Text color='muted-foreground'>Loading…</Text>
      </Center>
    );
  }

  if (!permissions.includes(PERMISSIONS.manageBilling)) {
    return (
      <Stack gap={6}>
        <PageHeader
          title='Resolve payment'
          description='Update your payment method to restore full access.'
        />
        <Alert data-testid='resolve-payment-access-denied'>
          <AlertTitle>You don&apos;t have billing access</AlertTitle>
          <AlertDescription>
            Resolving payment requires an organization admin. Please ask an
            admin to update the payment method.
          </AlertDescription>
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap={6}>
      <PageHeader
        title='Resolve payment'
        description='Update your payment method to retry the charge and restore full access.'
      />
      <ResolvePaymentForm subscription={subscription} />
    </Stack>
  );
}
