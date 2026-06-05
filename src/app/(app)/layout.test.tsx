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

// Mock next/link to avoid router context requirement in tests.
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/image (used by AppSidebar logo — renders a plain img in test env).
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />, // NOSONAR: ok in test
}));

import { organizationsCurrentRetrieve } from '@/client';
import AppLayout from './layout';

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
  return render(<AppLayout>{ui}</AppLayout>, { wrapper });
}

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

import type { CurrentMembership } from '@/client';

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
  vi.mocked(organizationsCurrentRetrieve).mockRejectedValue(
    new Error('Failed to load current organization (403)')
  );
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
      // No accessToken in localStorage → layout passes through children.
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
      localStorage.setItem('accessToken', 'test-token');
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
      localStorage.setItem('accessToken', 'test-token');
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
      localStorage.setItem('accessToken', 'test-token');
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
      localStorage.setItem('accessToken', 'test-token');
    });

    it('redirects a disabled user to /no-access', async () => {
      mockOrg403();
      renderLayout();

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/no-access');
      });

      // Shell should NOT be rendered while redirecting.
      expect(screen.queryByAltText('Vinta')).not.toBeInTheDocument();
    });
  });
});
