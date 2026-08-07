import { Suspense } from 'react';
import { getAuthByClientV1Config } from '@/auth-client';
import LoginForm from '@/components/authentication/login-form';
import { fetchBrandingForSlug } from '@/lib/branding-server';

/**
 * Slug-scoped branded login. Fetches public branding for the path slug and
 * renders the same LoginForm as `/auth/login`. Unknown/removed slugs resolve
 * to vinta default branding (no error page). Slug is display-only pre-auth —
 * OAuth callback plumbing is unchanged and does not org-scope membership.
 */
export default async function BrandedLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const branding = await fetchBrandingForSlug(slug);

  // Same auth-config degradation as generic login: unreachable backend →
  // form without social providers; never redirect back here.
  const authConfig = await getAuthByClientV1Config({
    path: {
      client: 'app',
    },
  });

  const socialProviders =
    authConfig.data?.status === 200
      ? (authConfig.data.data.socialaccount?.providers ?? [])
      : [];

  return (
    <Suspense fallback={null}>
      <LoginForm socialProviders={socialProviders} branding={branding} />
    </Suspense>
  );
}
