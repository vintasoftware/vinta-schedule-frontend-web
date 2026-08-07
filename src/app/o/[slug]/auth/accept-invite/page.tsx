import { Suspense } from 'react';
import AcceptInviteForm from '@/components/authentication/accept-invite-form';
import { fetchBrandingForSlug } from '@/lib/branding-server';

/**
 * Slug-scoped accept-invite route. `createInvitation`'s `inviteUrl` (and the
 * invitation email link) point here instead of the generic
 * `/auth/accept-invite/` whenever the invited organization (or its reseller
 * ancestor) has branding configured with a public slug. Unknown/removed
 * slugs resolve to vinta default branding (no error page) — same behavior as
 * the branded login route. Token handling is unchanged: still read from the
 * `token` query param by AcceptInviteForm.
 */
export default async function BrandedAcceptInvitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const branding = await fetchBrandingForSlug(slug);

  return (
    <Suspense fallback={null}>
      <AcceptInviteForm branding={branding} slug={slug} />
    </Suspense>
  );
}
