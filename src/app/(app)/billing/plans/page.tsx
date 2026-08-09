import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';

import { BillingPlansPicker } from '@/components/billing/billing-plans-picker';

/**
 * BillingPlansPage — the plan catalog + upgrade/downgrade/cancel (Phase 3).
 *
 * A server-first page: it stays a Server Component and renders the
 * `BillingPlansPicker` client island, which reads the catalog + current
 * subscription, exposes the monthly/annual toggle, and owns the change-plan /
 * cancel dialogs. Role gating (admin-only write affordances) and the free /
 * subscription-less path are handled inside the island.
 */
export default function BillingPlansPage() {
  return (
    <>
      <PageHeader
        title='Plans'
        description='Compare plans and change or cancel your subscription.'
      />
      <BillingPlansPicker />
    </>
  );
}
