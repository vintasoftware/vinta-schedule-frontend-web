import { cookies } from 'next/headers';
import { SocialSuccess } from '@/components/authentication/social-success';
import { fetchBrandingForTenant } from '@/lib/branding-server';

export default async function SocialSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const resolvedParams = await searchParams;

  const sessionToken = cookieStore.get('sessionToken')?.value;
  const accessToken = cookieStore.get('accessToken')?.value;
  const refreshToken = cookieStore.get('refreshToken')?.value;

  // Resolve tenant branding from the `tenant_id` query param (injected by the
  // OAuth state / callback route). Falls back to vinta default on any error.
  const tenantId =
    typeof resolvedParams.tenant_id === 'string'
      ? resolvedParams.tenant_id
      : undefined;
  const branding = await fetchBrandingForTenant(tenantId);

  return (
    <SocialSuccess
      // Only the presence crosses to the client — the token is httpOnly.
      hasPendingSession={Boolean(sessionToken)}
      accessToken={accessToken}
      refreshToken={refreshToken}
      branding={branding}
    />
  );
}
