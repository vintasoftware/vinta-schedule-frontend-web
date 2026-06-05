'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentOrganization } from '@/hooks/organizations/use-current-organization';

/**
 * Wraps authenticated content and enforces the tenant-onboarding gate.
 *
 * A user can be authenticated but have no organization yet ("gated" — a
 * mid-onboarding social user, or before email verification completes). Such a
 * user is redirected to the create-org / accept-invite screen instead of seeing
 * tenant content (whose lists would come back empty, which must NOT be read as
 * "no data" for gated users).
 *
 * Unauthenticated visitors are passed through untouched.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(Boolean(localStorage.getItem('accessToken')));
    setAuthChecked(true);
  }, []);

  const { isGated, isLoading } = useCurrentOrganization({
    enabled: authChecked && isAuthenticated,
  });

  useEffect(() => {
    if (isGated) {
      router.replace('/auth/onboarding');
    }
  }, [isGated, router]);

  // Auth is enforced elsewhere; the gate only acts on authenticated users.
  if (!authChecked || !isAuthenticated) {
    return <>{children}</>;
  }

  if (isLoading || isGated) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='text-muted-foreground'>Loading…</div>
      </div>
    );
  }

  return <>{children}</>;
}
