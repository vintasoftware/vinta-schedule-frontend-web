import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';

import { BillingOverview } from '@/components/billing/billing-overview';

/**
 * BillingPage — the billing overview & current-usage dashboard (Phase 2).
 *
 * A server-first page: it stays a Server Component (no 'use client') and renders
 * the `BillingOverview` client island, which calls the read hooks
 * (`useBillingUsage` / `useSubscription`) and composes the dashboard. This keeps
 * the route thin and lets Next.js stream the header while the data island
 * resolves. The free / subscription-less path and the no-active-org `403` are
 * handled inside `BillingOverview` — the page never crashes on either.
 */
export default function BillingPage() {
  return (
    <>
      <PageHeader
        title='Billing'
        description='Your plan, usage, and billing history.'
      />
      <BillingOverview />
    </>
  );
}
