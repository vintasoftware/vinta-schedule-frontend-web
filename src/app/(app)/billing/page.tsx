import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';

/**
 * BillingPage — placeholder billing overview.
 *
 * Phase 0 ships only the route skeleton: a heading, reachable by direct URL
 * with no sidebar entry (Phase 9 wires nav). The real current-usage dashboard
 * — plan snapshot, period bounds, billing_state, per-resource usage,
 * reseller attribution, accrued overage — lands in Phase 2 via the Phase 0
 * read hooks. A Server Component: nothing here needs client state yet.
 */
export default function BillingPage() {
  return (
    <PageHeader
      title='Billing'
      description='Your plan, usage, and billing history.'
    />
  );
}
