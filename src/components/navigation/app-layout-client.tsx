'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Calendar,
  CalendarSync,
  UsersRound,
  DoorOpen,
  Ticket,
  Settings,
  Webhook,
  GitPullRequestArrow,
  ShieldCheck,
} from 'lucide-react';

import { CreateOrganizationDialog } from '@/components/organizations/create-organization-dialog';

import {
  useCurrentOrganization,
  CURRENT_ORGANIZATION_QUERY_KEY,
} from '@/hooks/organizations/use-current-organization';
import { useActiveOrganization } from '@/hooks/organizations/use-active-organization';
import { useCurrentAuthSession } from '@/hooks/authentication/use-current-auth-session';
import { useProfile } from '@/hooks/users/use-profile';
import { useLogout } from '@/hooks/authentication/use-logout';
import { AppShell } from '@vinta-schedule/design-system/layout/app-shell';
import {
  AppSidebar,
  type SidebarNavGroup,
  type SidebarNavItem,
} from '@/components/navigation/app-sidebar';
import { AppTopbar } from '@vinta-schedule/design-system/layout/app-topbar';
import { NotificationsBell } from '@/components/notifications/notifications-bell';
import { Center } from '@vinta-schedule/design-system/layout/center';
import { Text } from '@vinta-schedule/design-system/layout/text';
import { RoleProvider } from '@/components/navigation/role-gate';
import type { RoleEnum } from '@/client';

// ---------------------------------------------------------------------------
// Nav groups — member sees the base set, admin additionally sees the team and
// sync-settings links. Built as static data so tests can snapshot them.
// ---------------------------------------------------------------------------

const MEMBER_NAV_ITEMS: SidebarNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Calendar, href: '/dashboard' },
  {
    id: 'calendars',
    label: 'My calendars',
    icon: CalendarSync,
    href: '/calendars',
  },
  { id: 'events', label: 'Events', icon: Ticket, href: '/events' },
  {
    id: 'change-requests',
    label: 'Change requests',
    icon: GitPullRequestArrow,
    href: '/change-requests',
  },
  {
    id: 'availability',
    label: 'Availability',
    icon: Settings,
    href: '/availability',
  },
];

const ADMIN_ONLY_NAV_ITEMS: SidebarNavItem[] = [
  { id: 'team', label: 'Team', icon: UsersRound, href: '/team' },
  {
    id: 'people-calendars',
    label: 'People calendars',
    icon: UsersRound,
    href: '/people-calendars',
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: DoorOpen,
    href: '/resources',
  },
  {
    id: 'groups',
    label: 'Calendar groups',
    icon: UsersRound,
    href: '/groups',
  },
  { id: 'bundles', label: 'Bundles', icon: Calendar, href: '/bundles' },
  {
    id: 'booking-policies',
    label: 'Booking policies',
    icon: ShieldCheck,
    href: '/booking-policies',
  },
  {
    id: 'sync-settings',
    label: 'Sync settings',
    icon: CalendarSync,
    href: '/sync-settings',
  },
  {
    id: 'api-tokens',
    label: 'API tokens',
    icon: Settings,
    href: '/api-tokens',
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    icon: Webhook,
    href: '/webhooks',
  },
];

function buildNavGroups(role: RoleEnum | null): SidebarNavGroup[] {
  const groups: SidebarNavGroup[] = [{ items: MEMBER_NAV_ITEMS }];

  if (role === 'admin') {
    groups.push({ label: 'Admin', items: ADMIN_ONLY_NAV_ITEMS });
  }

  return groups;
}

/** Up to two uppercase initials from a display name; '?' when empty. */
function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase());
  return letters.join('');
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Mirrors OnboardingGate: check localStorage for token presence on mount.
  useEffect(() => {
    setIsAuthenticated(
      document.cookie.split('; ').some((c) => c.startsWith('sessionActive='))
    );
    setAuthChecked(true);
  }, []);

  const { isGated, isOnboarded, isDisabled, membership, isLoading, isError } =
    useCurrentOrganization({
      enabled: authChecked && isAuthenticated,
    });

  // Bootstrap the active-org selection. Runs only for authenticated users so
  // mine/ is not fetched on public/auth pages. The hook auto-resolves single-org
  // users, heals stale stored ids, and surfaces needsSelection for Phase 3b.
  // isGated (isMineGated) is the authoritative "0 active memberships" signal
  // from mine/ and drives the onboarding redirect alongside useCurrentOrganization's
  // 404-based isGated signal.
  const {
    isLoading: isActiveOrgLoading,
    isError: isActiveOrgError,
    isGated: isMineGated,
    needsSelection,
    memberships,
    activeOrganizationId,
    activeMembership,
    setActive,
  } = useActiveOrganization({
    enabled: authChecked && isAuthenticated,
  });

  // Logged-in user: real name from the profile API (JWT-auth), email from the
  // allauth session (the profile endpoint doesn't expose it).
  const { profile } = useProfile({ enabled: authChecked && isAuthenticated });
  const { session } = useCurrentAuthSession({
    enabled: authChecked && isAuthenticated,
  });

  const { logout } = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.replace('/auth/login');
    }
  };

  // Stale-selection recovery (Phase 9 — UC6 on-shell path).
  //
  // When the bootstrap (useActiveOrganization) heals a stale stored id and a
  // valid activeMembership is now available, `current/` still holds the cached
  // `disabled` sentinel from the original 403. The QueryCache.onError recovery
  // never fires here because use-current-organization SWALLOWS the 403 (returns
  // a sentinel instead of throwing). This effect bridges that gap:
  //
  //   isDisabled           — current/ returned a stale-selection 403.
  //   activeMembership     — bootstrap has already healed the store; the user
  //                          has a valid active org (non-null means resolved + valid).
  //
  // When both are true: invalidate current/ so it refetches with the corrected
  // X-Organization-Id header. Toast once to inform the user.
  //
  // LOOP GUARD: `staleRecoveredRef` is set to `true` the moment we invalidate,
  // and reset only when `isDisabled` clears (i.e. the refetch resolved 200).
  // This prevents re-invalidating on every render while current/ is still in
  // flight after the first invalidation.
  //
  // MULTI-ORG UNSET case (bootstrap leaves selection unset → needsSelection →
  // /auth/select-organization redirect): `activeMembership` is null when no valid
  // selection exists, so this effect never fires in that path — naturally excluded.
  const staleRecoveredRef = useRef(false);
  useEffect(() => {
    if (!isDisabled) {
      // Reset guard when the stale episode clears so a future stale episode
      // can trigger recovery again.
      staleRecoveredRef.current = false;
      return;
    }

    if (activeMembership === null) return; // no healed selection yet; wait
    if (staleRecoveredRef.current) return; // already invalidated this episode

    staleRecoveredRef.current = true;
    void queryClient.invalidateQueries({
      queryKey: CURRENT_ORGANIZATION_QUERY_KEY,
    });
    toast('Organization updated — refreshing your session.');
  }, [isDisabled, activeMembership, queryClient]);

  // Single authoritative "send to onboarding" signal — combines both sources of
  // "no memberships" while ensuring isDisabled takes precedence:
  //   • isGated — useCurrentOrganization returned 404 (current/ not onboarded)
  //   • isMineGated — mine/ returned [] (authoritative per plan Guiding Decisions)
  // isDisabled (403 → /no-access) wins over both: a disabled user is NEVER sent
  // to onboarding, even if mine/ is also empty.
  // authChecked && isAuthenticated: both queries are disabled until auth is
  // confirmed. Before that, isMineGated defaults to true (empty memberships
  // array) and isActiveOrgLoading is false (disabled query never fetches) —
  // which would falsely trigger isOnboardingGated. Gate on auth confirmation so
  // we never evaluate gating signals for unauthenticated/unconfirmed sessions.
  // !isLoading guards the isMineGated path against a race where mine/ resolves
  // before current/: we must know current/'s status (especially disabled) before
  // acting on mine/. Guard against transient mine/ errors so a network failure
  // doesn't bounce a real user to onboarding.
  const isOnboardingGated =
    authChecked &&
    isAuthenticated &&
    !isDisabled &&
    (isGated ||
      (!isLoading && isMineGated && !isActiveOrgLoading && !isActiveOrgError));

  // Redirect org-less (but not disabled) users to onboarding.
  // idempotent, no loop risk; isDisabled precedence prevents double-redirect
  // to both /auth/onboarding and /no-access in the same render.
  useEffect(() => {
    if (isOnboardingGated) {
      router.replace('/auth/onboarding');
    }
  }, [isOnboardingGated, router]);

  // Disabled membership (403): route to /no-access only when the user
  // genuinely has no orgs remaining in mine/. With multi-org support, a stale
  // selection also produces current/ 403 (→ isDisabled), but those users
  // still have valid orgs — the QueryCache 403 recovery (Phase 9 UC6)
  // re-picks from mine/ and invalidates, then current/ refetches and resolves.
  // We must NOT redirect them to /no-access; instead we hold LoadingView while
  // recovery runs. Only redirect when mine/ has resolved to empty (isMineGated),
  // which confirms the user has absolutely no remaining memberships.
  //
  // Redirect lives outside (app) to avoid re-running this layout and
  // triggering an infinite redirect loop.
  const isMineEmptyResolved =
    isMineGated && !isActiveOrgLoading && !isActiveOrgError;
  useEffect(() => {
    if (isDisabled && isMineEmptyResolved) {
      router.replace('/no-access');
    }
  }, [isDisabled, isMineEmptyResolved, router]);

  // Multi-org user with no valid stored selection: send them to the
  // selection gate (/auth/select-organization lives outside (app) so this
  // layout does not re-run for that route — no redirect loop).
  useEffect(() => {
    if (needsSelection) {
      router.replace('/auth/select-organization');
    }
  }, [needsSelection, router]);

  // Not yet checked — render nothing until we know auth state.
  if (!authChecked || !isAuthenticated) {
    return <>{children}</>;
  }

  // Render guard: hold LoadingView while any gating signal is active or a
  // redirect is in-flight. isOnboardingGated covers both isGated and the
  // resolved-isMineGated case so tenant views don't flash before the onboarding
  // redirect fires. isDisabled is listed separately so disabled users also hold
  // LoadingView while the /no-access redirect fires.
  // isActiveOrgLoading ensures the bootstrap effect has had a chance to prime
  // the X-Organization-Id header for single-org users.
  // needsSelection keeps tenant views from flashing before /auth/select-organization.
  if (
    isLoading ||
    isActiveOrgLoading ||
    isOnboardingGated ||
    isDisabled ||
    needsSelection
  ) {
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

  const sessionUser = session?.data?.user;
  const userEmail =
    typeof sessionUser?.email === 'string' ? sessionUser.email : '';

  // Prefer the real profile name (first + last); fall back to the allauth
  // session display, then the email local-part, then a neutral label.
  const profileName = [profile?.first_name, profile?.last_name]
    .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    .join(' ')
    .trim();
  const sessionDisplay =
    typeof sessionUser?.display === 'string' ? sessionUser.display.trim() : '';
  const emailLocalPart = userEmail.includes('@') ? userEmail.split('@')[0] : '';
  const userName = profileName || sessionDisplay || emailLocalPart || 'Account';

  const orgMeta = role === 'admin' ? 'Admin' : 'Member';

  const sidebar = (
    <AppSidebar
      groups={navGroups}
      orgName={orgName}
      orgMeta={orgMeta}
      userName={userName}
      userEmail={userEmail}
      userInitials={initialsFromName(userName)}
      userPicture={profile?.profile_picture ?? undefined}
      onLogout={handleLogout}
      memberships={memberships}
      activeOrgId={activeOrganizationId}
      onSelectOrg={setActive}
      onCreateOrg={() => setCreateDialogOpen(true)}
    />
  );

  // Minimal topbar: no title/search/sync yet — just hosts the notifications
  // bell (and, on mobile, the nav trigger injected into its leading slot).
  const topbar = (
    <AppTopbar showSearch={false} sync={null} actions={<NotificationsBell />} />
  );

  return (
    <RoleProvider role={role}>
      <AppShell sidebar={sidebar} topbar={topbar}>
        {children}
      </AppShell>
      <CreateOrganizationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={(newOrg) => {
          setCreateDialogOpen(false);
          setActive(String(newOrg.id));
        }}
      />
    </RoleProvider>
  );
}
