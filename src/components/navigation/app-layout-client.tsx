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
import { Center } from '@/components/layout/center';
import { Text } from '@/components/layout/text';
import { RoleProvider } from '@/components/navigation/role-gate';
import type { RoleEnum } from '@/client';

// ---------------------------------------------------------------------------
// Nav groups — member sees the base set, admin additionally sees the team and
// sync-settings links. Built as static data so tests can snapshot them.
// ---------------------------------------------------------------------------

const MEMBER_NAV_ITEMS: SidebarNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Calendar },
  {
    id: 'calendars',
    label: 'My calendars',
    icon: CalendarSync,
    href: '/calendars',
  },
  { id: 'events', label: 'Events', icon: Ticket, href: '/events' },
  { id: 'availability', label: 'Availability', icon: Settings },
];

const ADMIN_ONLY_NAV_ITEMS: SidebarNavItem[] = [
  { id: 'team', label: 'Team', icon: UsersRound, href: '/team' },
  {
    id: 'all-calendars',
    label: 'All calendars',
    icon: CalendarSync,
    href: '/all-calendars',
  },
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
// LoadingView — shared loading/redirecting placeholder. Used while org data is
// resolving and while a redirect is in-flight.
// ---------------------------------------------------------------------------

function LoadingView() {
  return (
    <Center minHeight='screen'>
      <Text color='muted-foreground'>Loading…</Text>
    </Center>
  );
}

// ---------------------------------------------------------------------------
// AppLayoutClient — wraps every (app) route in the app shell + role context.
//
// Gating behaviour:
//   • Unauthenticated: passed through (auth is enforced by the login flow).
//   • Org-less (gated): redirect to /auth/onboarding (matches OnboardingGate).
//   • Disabled membership (403 from the org endpoint): redirect to /no-access.
//   • Onboarded: render the shell, expose role via RoleProvider.
// ---------------------------------------------------------------------------

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Mirrors OnboardingGate: check localStorage for token presence on mount.
  useEffect(() => {
    setIsAuthenticated(Boolean(localStorage.getItem('accessToken')));
    setAuthChecked(true);
  }, []);

  const { isGated, isOnboarded, isDisabled, membership, isLoading, isError } =
    useCurrentOrganization({
      enabled: authChecked && isAuthenticated,
    });

  // Redirect org-less authenticated users to onboarding (not back into (app)).
  useEffect(() => {
    if (isGated) {
      router.replace('/auth/onboarding');
    }
  }, [isGated, router]);

  // Disabled membership (403): route to /no-access — lives outside (app) to
  // avoid re-running this layout and triggering an infinite redirect loop.
  useEffect(() => {
    if (isDisabled) {
      router.replace('/no-access');
    }
  }, [isDisabled, router]);

  // Not yet checked — render nothing until we know auth state.
  if (!authChecked || !isAuthenticated) {
    return <>{children}</>;
  }

  if (isLoading || isGated || isDisabled) {
    return <LoadingView />;
  }

  if (isError) {
    // Unexpected error: show a neutral loading state while a redirect (if any)
    // fires via a separate effect.
    return <LoadingView />;
  }

  const role: RoleEnum | null = isOnboarded ? (membership?.role ?? null) : null;
  const orgName =
    isOnboarded && membership?.organization
      ? typeof membership.organization.name === 'string'
        ? membership.organization.name
        : 'Organization'
      : 'Organization';

  const navGroups = buildNavGroups(role);

  const sidebar = <AppSidebar groups={navGroups} orgName={orgName} />;

  const topbar = (
    <AppTopbar title='Vinta Schedule' showSearch={false} sync={null} />
  );

  return (
    <RoleProvider role={role}>
      <AppShell sidebar={sidebar} topbar={topbar}>
        {children}
      </AppShell>
    </RoleProvider>
  );
}
