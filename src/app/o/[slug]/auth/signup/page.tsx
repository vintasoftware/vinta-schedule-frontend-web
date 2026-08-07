import { Suspense } from 'react';
import SignupForm from '@/components/authentication/signup-form';
import { fetchBrandingForSlug } from '@/lib/branding-server';
import { isVintaDefaultBranding } from '@/lib/branding-shared';

/**
 * Slug-scoped branded signup. Renders the same SignupForm as `/auth/signup`
 * with the tenant's identity and colors, and with the organization name fixed
 * by the link rather than typed by the visitor.
 *
 * The organization name comes from the branding's `appName` — the only tenant
 * name the public `brandingForTenant` query exposes. Signup still creates a
 * NEW organization under that name (the API's `organization_name` has no
 * join-existing-org semantics), and the backend refuses when the user already
 * belongs to an organization.
 *
 * Unknown/removed slugs resolve to vinta default branding with no error page,
 * same as the branded login and accept-invite routes. In that case the field
 * stays empty and editable — locking it to the vinta fallback name would put
 * a wrong organization name in front of the visitor.
 */
export default async function BrandedSignupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const branding = await fetchBrandingForSlug(slug);

  const lockedOrganizationName = isVintaDefaultBranding(branding)
    ? undefined
    : branding.appName;

  return (
    <Suspense fallback={null}>
      <SignupForm
        branding={branding}
        slug={slug}
        lockedOrganizationName={lockedOrganizationName}
      />
    </Suspense>
  );
}
