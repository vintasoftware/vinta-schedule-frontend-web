import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';

import { BillingPlansPicker } from '@/components/billing/billing-plans-picker';

/**
 * BillingPlansPage — the plan catalog + upgrade/downgrade/cancel (Phase 3).
 *
 * A server-first page: it stays a Server Component and renders the
 * `BillingPlansPicker` client island, which reads the catalog + current
 * subscription, exposes the monthly/annual toggle, and owns the change-plan /
 * cancel dialogs. Capability gating (`payments.manage_billing`-only write
 * affordances) and the free / subscription-less path are handled inside the
 * island.
 *
 * `?resource=<key>` (Phase 8, billing-hardening-gap-closure plan): the
 * global over-limit handler's `upgrade_plan` remedy (and
 * `billingUpgradePath` generally) deep-link here with the resource that
 * triggered the rejection, via `billingUpgradePath` in
 * `@/lib/utils/api-errors`. Read server-side and forwarded to the picker so
 * it can highlight the plans that actually raise that resource's limit —
 * previously the param was read nowhere and the deep-link landed on an
 * undifferentiated catalog.
 */
export default async function BillingPlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const resourceParam = resolvedParams.resource;
  const highlightResource =
    typeof resourceParam === 'string' ? resourceParam : undefined;

  return (
    <>
      <PageHeader
        title='Plans'
        description='Compare plans and change or cancel your subscription.'
      />
      <BillingPlansPicker highlightResource={highlightResource} />
    </>
  );
}
