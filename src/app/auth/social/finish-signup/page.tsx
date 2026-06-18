import { fetchBrandingForTenant } from '@/lib/branding-server';
import { FinishSignupForm } from '@/components/authentication/finish-signup-form';

/**
 * Server component shell: fetches tenant branding from the query param and
 * passes it to the client form. The form itself must be a client component
 * because it uses hooks (useRouter, useState, react-hook-form, TanStack Query).
 */
export default async function ProviderSignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;

  // Resolve tenant branding from the `tenant_id` query param (injected by the
  // OAuth state / callback route). Falls back to vinta default on any error.
  const tenantId =
    typeof resolvedParams.tenant_id === 'string'
      ? resolvedParams.tenant_id
      : undefined;
  const branding = await fetchBrandingForTenant(tenantId);

  return <FinishSignupForm branding={branding} />;
}
