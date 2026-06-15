import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// --- Mocks ------------------------------------------------------------------

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/',
}));

// Mock the generated org client operation so we can control its response.
vi.mock('@/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client')>();
  return {
    ...original,
    organizationsCurrentRetrieve: vi.fn(),
  };
});

// Mock organizationsMineList from the SDK so we can control the mine/ response
// independently of organizationsCurrentRetrieve (needed for Phase 6 tests that
// assert isMineGated → /auth/onboarding without relying on a 404).
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    organizationsMineList: vi.fn(),
  };
});

// Mock next/link to avoid router context requirement in tests.
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { organizationsCurrentRetrieve } from '@/client';
import { organizationsMineList } from '@/client/sdk.gen';
import { AppLayoutClient } from '@/components/navigation/app-layout-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderLayout(ui: ReactNode = <div>page content</div>) {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<AppLayoutClient>{ui}</AppLayoutClient>, { wrapper });
}

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

import type { CurrentMembership, MyMembership } from '@/client';

const MEMBER_MEMBERSHIP: CurrentMembership = {
  role: 'member',
  organization: { id: 1, name: 'Test Org' },
};

const ADMIN_MEMBERSHIP: CurrentMembership = {
  role: 'admin',
  organization: { id: 1, name: 'Test Org' },
};

function mockOrgSuccess(membership: CurrentMembership) {
  vi.mocked(organizationsCurrentRetrieve).mockResolvedValue({
    data: membership,
    response: jsonResponse(200, membership),
    error: undefined,
  } as unknown as Awaited<ReturnType<typeof organizationsCurrentRetrieve>>);
}

function mockOrg404() {
  vi.mocked(organizationsCurrentRetrieve).mockResolvedValue({
    data: undefined,
    response: jsonResponse(404, {}),
    error: undefined,
  } as unknown as Awaited<ReturnType<typeof organizationsCurrentRetrieve>>);
}

function mockOrg403() {
  vi.mocked(organizationsCurrentRetrieve).mockResolvedValue({
    data: undefined,
    response: new Response(null, { status: 403 }),
    error: undefined,
  } as unknown as Awaited<ReturnType<typeof organizationsCurrentRetrieve>>);
}

function mockMineList(memberships: MyMembership[]) {
  vi.mocked(organizationsMineList).mockResolvedValue({
    data: memberships,
    response: new Response(JSON.stringify(memberships), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof organizationsMineList>>);
}

function mockMineEmpty() {
  mockMineList([]);
}

// AppLayoutClient detects an authenticated user via the `sessionActive` cookie
// (set by the auth flow). vitest.setup.ts clears cookies between tests.
function setSessionActiveCookie() {
  document.cookie = 'sessionActive=1; path=/';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppLayout (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('unauthenticated user', () => {
    it('renders children without the shell when not authenticated', () => {
      // No `sessionActive` cookie → layout passes through children.
      mockOrgSuccess(MEMBER_MEMBERSHIP);
      renderLayout(<div>page content</div>);
      // Children visible immediately (no auth check).
      expect(screen.getByText('page content')).toBeInTheDocument();
      // The shell sidebar brand should NOT be present.
      expect(screen.queryByAltText('Vinta')).not.toBeInTheDocument();
    });
  });

  describe('onboarded member', () => {
    beforeEach(() => {
      setSessionActiveCookie();
    });

    it('renders the app shell with sidebar for an onboarded member', async () => {
      mockOrgSuccess(MEMBER_MEMBERSHIP);
      renderLayout(<div>page content</div>);

      // Wait for the org query to resolve and shell to mount.
      await waitFor(() => {
        expect(screen.getByAltText('Vinta')).toBeInTheDocument();
      });

      expect(screen.getByText('page content')).toBeInTheDocument();
    });

    it('shows member nav items', async () => {
      mockOrgSuccess(MEMBER_MEMBERSHIP);
      renderLayout();

      await waitFor(() => {
        expect(screen.getByAltText('Vinta')).toBeInTheDocument();
      });

      // Member nav items should be visible.
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('My calendars')).toBeInTheDocument();
      expect(screen.getByText('Events')).toBeInTheDocument();
    });

    it('does not show admin nav items for a member', async () => {
      mockOrgSuccess(MEMBER_MEMBERSHIP);
      renderLayout();

      await waitFor(() => {
        expect(screen.getByAltText('Vinta')).toBeInTheDocument();
      });

      // Admin-only nav items should be absent.
      expect(screen.queryByText('Team')).not.toBeInTheDocument();
      expect(screen.queryByText('API tokens')).not.toBeInTheDocument();
    });
  });

  describe('onboarded admin', () => {
    beforeEach(() => {
      setSessionActiveCookie();
    });

    it('shows admin nav items for an admin user', async () => {
      mockOrgSuccess(ADMIN_MEMBERSHIP);
      renderLayout();

      await waitFor(() => {
        expect(screen.getByAltText('Vinta')).toBeInTheDocument();
      });

      // Admin nav group items should be visible.
      expect(screen.getByText('Team')).toBeInTheDocument();
      expect(screen.getByText('API tokens')).toBeInTheDocument();
    });
  });

  describe('org-less (gated) user', () => {
    beforeEach(() => {
      setSessionActiveCookie();
    });

    it('redirects a gated user to /auth/onboarding', async () => {
      mockOrg404();
      renderLayout();

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/auth/onboarding');
      });

      // Shell should NOT be rendered while redirecting.
      expect(screen.queryByAltText('Vinta')).not.toBeInTheDocument();
    });
  });

  describe('disabled user (403)', () => {
    beforeEach(() => {
      setSessionActiveCookie();
    });

    it('redirects a disabled user with empty mine/ to /no-access', async () => {
      mockOrg403();
      mockMineEmpty();
      renderLayout();

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/no-access');
      });

      // Shell should NOT be rendered while redirecting.
      expect(screen.queryByAltText('Vinta')).not.toBeInTheDocument();
    });
  });

  // Phase 9: stale-selection 403 recovery — isDisabled + mine NON-empty must
  // NOT redirect to /no-access. The QueryCache 403 recovery re-picks from
  // mine/ and invalidates; then current/ refetches with a valid header and
  // isDisabled clears. The layout should hold LoadingView while this happens.
  describe('stale-selection 403 (Phase 9 — UC6)', () => {
    beforeEach(() => {
      setSessionActiveCookie();
    });

    it('does NOT redirect to /no-access when current/ 403 (isDisabled) but mine/ has orgs', async () => {
      // Simulate a stale-selection scenario: current/ returns 403 (→ isDisabled)
      // but mine/ returns orgs (user is still a member of some orgs).
      mockOrg403();
      mockMineList([
        {
          organization: { id: 1, name: 'Org A' },
          role: 'admin',
        } as MyMembership,
      ]);
      renderLayout();

      // Give the component time to settle (queries resolve, effects run).
      await waitFor(() => {
        // mine/ query has resolved to a non-empty list.
        expect(screen.getByText('Loading…')).toBeInTheDocument();
      });

      // /no-access redirect must NOT fire — the user still has valid orgs.
      expect(replace).not.toHaveBeenCalledWith('/no-access');
      // Shell must not be shown while recovery is in-flight.
      expect(screen.queryByAltText('Vinta')).not.toBeInTheDocument();
    });

    it('holds LoadingView (no shell flash) while isDisabled + mine/ has orgs', async () => {
      mockOrg403();
      mockMineList([
        {
          organization: { id: 2, name: 'Org B' },
          role: 'member',
        } as MyMembership,
      ]);
      renderLayout(<div>page content</div>);

      // The Loading text confirms LoadingView is held — page content must not be
      // visible (tenant view must not flash while recovery is running).
      await waitFor(() => {
        expect(screen.getByText('Loading…')).toBeInTheDocument();
      });

      expect(screen.queryByText('page content')).not.toBeInTheDocument();
      expect(replace).not.toHaveBeenCalledWith('/no-access');
    });
  });

  // Phase 6: mine/-empty is the authoritative "0 memberships" signal.
  // When mine/ returns [] the layout must redirect to onboarding and suppress
  // the shell. Crucially it must NOT also redirect to /auth/select-organization
  // (which would only apply to needsSelection = memberships.length > 1).
  describe('mine/-empty (isMineGated) user (Phase 6 — UC4a)', () => {
    beforeEach(() => {
      setSessionActiveCookie();
    });

    it('redirects to /auth/onboarding when mine/ returns an empty list', async () => {
      // current/ also 404s for a 0-org user, but test mine/-empty as the
      // authoritative signal by making both consistent.
      mockOrg404();
      mockMineEmpty();
      renderLayout();

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/auth/onboarding');
      });

      // Shell must not be shown while redirecting.
      expect(screen.queryByAltText('Vinta')).not.toBeInTheDocument();
    });

    it('does NOT redirect to /auth/select-organization when mine/ is empty (no double-redirect)', async () => {
      // A 0-org user must only go to /auth/onboarding, not also get a
      // /auth/select-organization redirect (needsSelection must be false
      // when memberships.length === 0, since needsSelection requires length > 1).
      mockOrg404();
      mockMineEmpty();
      renderLayout();

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/auth/onboarding');
      });

      expect(replace).not.toHaveBeenCalledWith('/auth/select-organization');
    });

    // isMineGated in isolation: current/ returns 200 (not 404/403) but mine/
    // returns [] — the empty mine/ list alone must be enough to gate the user
    // and redirect to /auth/onboarding.
    it('redirects to /auth/onboarding when mine/ is empty even if current/ is not 404', async () => {
      // current/ says "onboarded" (200), but mine/ returns an empty list.
      // isMineGated must still gate the user toward onboarding.
      mockOrgSuccess(MEMBER_MEMBERSHIP);
      mockMineEmpty();
      renderLayout();

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/auth/onboarding');
      });

      // Shell must not be shown while redirecting.
      expect(screen.queryByAltText('Vinta')).not.toBeInTheDocument();
    });
  });

  // Phase 6 BLOCKER: disabled + empty mine/ must be mutually exclusive.
  // A disabled user (403 from current/) with an empty mine/ list must go to
  // /no-access ONLY — never to /auth/onboarding.
  describe('disabled user with empty mine/ (collision guard)', () => {
    beforeEach(() => {
      setSessionActiveCookie();
    });

    it('redirects to /no-access and NOT /auth/onboarding when disabled and mine/ is empty', async () => {
      // current/ 403 (isDisabled=true) + mine/ empty (isMineGated=true).
      // isDisabled must take precedence: only /no-access should fire.
      mockOrg403();
      mockMineEmpty();
      renderLayout();

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/no-access');
      });

      // The onboarding redirect must never fire for a disabled user.
      expect(replace).not.toHaveBeenCalledWith('/auth/onboarding');
    });
  });
});
