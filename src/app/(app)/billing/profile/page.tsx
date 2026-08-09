import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';

import { BillingProfileForm } from '@/components/billing/billing-profile-form';

/**
 * BillingProfilePage — the billing profile (tax / payer identity) route
 * (Phase 6). Supports Use-case 3 / objective 2: the payer identity a charge is
 * billed against.
 *
 * A server-first page: it stays a Server Component (no 'use client') and renders
 * the `BillingProfileForm` client island, which reads the current profile
 * (`useBillingProfile`), decides create-vs-update, and owns the admin gate + the
 * read-only view for non-admins. The no-profile (404) path renders an empty
 * create form — the page never crashes on an absent profile.
 */
export default function BillingProfilePage() {
  return (
    <>
      <PageHeader
        title='Billing profile'
        description='Your tax document and payer identity for billing.'
      />
      <BillingProfileForm />
    </>
  );
}
