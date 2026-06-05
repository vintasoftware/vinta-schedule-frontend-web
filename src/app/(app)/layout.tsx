'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CalendarSync,
  UsersRound,
  Ticket,
  Settings,
} from 'lucide-react';

import { useCurrentOrganization } from '@/hooks/organizations/use-current-organization';
import { AppShell } from '@/components/layout/app-shell';
import {
  AppSidebar,
  type SidebarNavGroup,
  type SidebarNavItem,
} from '@/components/layout/app-sidebar';
import { AppTopbar } from '@/components/layout/app-topbar';
import { RoleProvider } from '@/components/navigation/role-gate';
import type { RoleEnum } from '@/client';

// ---------------------------------------------------------------------------
// Nav groups — member sees the base set, admin additionally sees the team and
// sync-settings links. Built as static data so tests can snapshot them.
// ---------------------------------------------------------------------------

const MEMBER_NAV_ITEMS: SidebarNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Calendar },
  { id: 'calendars', label: 'My calendars', icon: CalendarSync },
  { id: 'events', label: 'Events', icon: Ticket },
  { id: 'availability', label: 'Availability', icon: Settings },
];

const ADMIN_ONLY_NAV_ITEMS: SidebarNavItem[] = [
  { id: 'team', label: 'Team', icon: UsersRound },
  { id: 'all-calendars', label: 'All calendars', icon: CalendarSync },
  { id: 'groups', label: 'Calendar groups', icon: UsersRound },
  { id: 'bundles', label: 'Bundles', icon: Calendar },
  { id: 'sync-settings', label: 'Sync settings', icon: CalendarSync },
  { id: 'api-tokens', label: 'API tokens', icon: Settings },
];

function buildNavGroups(role: RoleEnum | null): SidebarNavGroup[] {
  const groups: SidebarNavGroup[] = [{ items: MEMBER_NAV_ITEMS }];

  if (role === 'admin') {
    groups.push({ label: 'Admin', items: ADMIN_ONLY_NAV_ITEMS });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// AppLayout — wraps every (app) route in the app shell + role context.
//
// Gating behaviour:
//   • Unauthenticated: passed through (auth is enforced by the login flow).
//   • Org-less (gated): redirect to /auth/onboarding (matches OnboardingGate).
//   • Disabled membership (403 from the org endpoint): redirect to /no-access.
//   • Onboarded: render the shell, expose role via RoleProvider.
// ---------------------------------------------------------------------------

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Mirrors OnboardingGate: check localStorage for token presence on mount.
  useEffect(() => {
    setIsAuthenticated(Boolean(localStorage.getItem('accessToken')));
    setAuthChecked(true);
  }, []);

  const { isGated, isOnboarded, membership, isLoading, isError, error } =
    useCurrentOrganization({
      enabled: authChecked && isAuthenticated,
    });

  // Redirect org-less authenticated users to onboarding (not back into (app)).
  useEffect(() => {
    if (isGated) {
      router.replace('/auth/onboarding');
    }
  }, [isGated, router]);

  // Disabled membership or 403: route to no-access (not back into (app)).
  useEffect(() => {
    if (isError && error) {
      const message = (error as Error).message ?? '';
      if (message.includes('403')) {
        router.replace('/no-access');
      }
    }
  }, [isError, error, router]);

  // Not yet checked — render nothing until we know auth state.
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

  if (isError) {
    // Error handling (including 403/disabled) is done via useEffect redirect above.
    // Render a neutral loading state while the redirect fires.
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='text-muted-foreground'>Loading…</div>
      </div>
    );
  }

  const role = isOnboarded ? (membership?.role ?? null) : null;
  const orgName =
    isOnboarded && membership?.organization
      ? String(
          (membership.organization as Record<string, unknown>).name ??
            'Organization'
        )
      : 'Organization';

  const navGroups = buildNavGroups(role as RoleEnum | null);

  const sidebar = <AppSidebar groups={navGroups} orgName={orgName} />;

  const topbar = (
    <AppTopbar title='Vinta Schedule' showSearch={false} sync={null} />
  );

  return (
    <RoleProvider role={role as RoleEnum | null}>
      <AppShell sidebar={sidebar} topbar={topbar}>
        {children}
      </AppShell>
    </RoleProvider>
  );
}
