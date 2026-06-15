'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Stack, Heading, Text } from '@/components/layout';
import { AuthNavbar } from '@/components/authentication/auth-navbar';
import { useActiveOrganization } from '@/hooks/organizations/use-active-organization';

// ---------------------------------------------------------------------------
// SelectOrganizationPage
//
// Mandatory selection gate for authenticated multi-org users. Renders when
// `needsSelection` is true (2+ memberships, no valid stored selection).
//
// Guard logic (run as effects / early returns to avoid loops):
//   - isLoading        → render a loading state
//   - isGated (0 orgs) → redirect to /auth/onboarding
//   - single org OR already-valid activeMembership (needsSelection=false)
//                      → redirect to /  (single-org auto-selected in Phase 3a)
//   - otherwise        → render the org picker
//
// Lives under /auth (outside the (app) route group) so the app-layout-client
// does NOT re-run for this route, preventing the needsSelection→redirect→
// select-organization→app-shell loop.
// ---------------------------------------------------------------------------

export default function SelectOrganizationPage() {
  const router = useRouter();
  const {
    memberships,
    activeMembership,
    isGated,
    isLoading,
    needsSelection,
    setActive,
  } = useActiveOrganization();

  // Guard: no orgs → onboarding.
  useEffect(() => {
    if (!isLoading && isGated) {
      router.replace('/auth/onboarding');
    }
  }, [isGated, isLoading, router]);

  // Guard: already have a valid selection or only one org (auto-selected by
  // Phase 3a bootstrap) → dashboard. Also fires if the user picks and
  // useActiveOrganization re-renders with activeMembership set before
  // router.replace fires — harmless double call.
  useEffect(() => {
    if (!isLoading && !isGated && !needsSelection) {
      router.replace('/');
    }
  }, [isGated, isLoading, needsSelection, router]);

  const handleSelect = (orgId: number) => {
    setActive(String(orgId));
    router.replace('/');
  };

  // Render a loading state while resolving or while a redirect effect is about
  // to fire (isGated / !needsSelection guard above).
  if (isLoading || isGated || !needsSelection) {
    return (
      <AuthLayout navbar={<AuthNavbar />} variant='single'>
        <Card className='flex w-full max-w-md flex-col gap-8 p-8'>
          <Text color='muted-foreground'>Loading…</Text>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout navbar={<AuthNavbar />} variant='single'>
      <Card className='flex w-full max-w-md flex-col gap-8 p-8'>
        <Stack gap={4}>
          <Heading level={1} size='3xl'>
            Choose an organization
          </Heading>
          <Text size='sm' color='muted-foreground'>
            You belong to multiple organizations. Select one to continue.
          </Text>
        </Stack>

        <Stack gap={3}>
          {memberships.map((membership) => (
            <Button
              key={membership.organization.id}
              variant='outline'
              className='flex h-auto w-full items-center justify-between px-4 py-3 text-left'
              onClick={() => handleSelect(membership.organization.id)}
              aria-pressed={
                activeMembership?.organization.id === membership.organization.id
              }
            >
              <span className='font-medium'>
                {membership.organization.name}
              </span>
              <Badge variant='secondary' className='ml-2 shrink-0 capitalize'>
                {membership.role}
              </Badge>
            </Button>
          ))}
        </Stack>
      </Card>
    </AuthLayout>
  );
}
