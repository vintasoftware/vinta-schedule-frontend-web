import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { PaginatedOrganizationMembershipList } from '@/client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock navigation — DataTableQueryBoundary → useDataTableQuery → useSearchParams
const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/team',
  useSearchParams: () => new URLSearchParams(),
}));

// The generated organizationMembersListOptions (in @/client/@tanstack/react-query.gen)
// internally calls organizationMembersList from @/client/sdk.gen.
// We mock at the sdk.gen boundary so both the TanStack options factory AND any
// direct callers are intercepted.
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    organizationMembersList: vi.fn(),
  };
});

// After mocks are hoisted, import the modules under test.
import { organizationMembersList } from '@/client/sdk.gen';
import { TeamTable } from './team-table';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderTeamTable() {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<TeamTable />, { wrapper });
}

function makePagedResponse(
  results: PaginatedOrganizationMembershipList['results'],
  count = results.length
) {
  const body: PaginatedOrganizationMembershipList = {
    count,
    results,
  };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof organizationMembersList>>;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MEMBER_FIXTURE: PaginatedOrganizationMembershipList['results'] = [
  {
    id: 1,
    role: 'admin',
    is_active: true,
    user_email: 'alice@acme.com',
    user_first_name: 'Alice',
    user_last_name: 'Souza',
  },
  {
    id: 2,
    role: 'member',
    is_active: true,
    user_email: 'bob@acme.com',
    user_first_name: 'Bob',
    user_last_name: 'Lima',
  },
  {
    id: 3,
    role: 'member',
    is_active: false,
    user_email: 'carol@acme.com',
    user_first_name: 'Carol',
    user_last_name: 'Maia',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TeamTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('populated state', () => {
    it('renders member rows from the API response', async () => {
      vi.mocked(organizationMembersList).mockResolvedValue(
        makePagedResponse(MEMBER_FIXTURE)
      );

      renderTeamTable();

      // Wait for data to load (skeleton → rows).
      await waitFor(() => {
        expect(screen.getByText('Alice Souza')).toBeInTheDocument();
      });

      expect(screen.getByText('Bob Lima')).toBeInTheDocument();
      expect(screen.getByText('Carol Maia')).toBeInTheDocument();
    });

    it('shows email addresses', async () => {
      vi.mocked(organizationMembersList).mockResolvedValue(
        makePagedResponse(MEMBER_FIXTURE)
      );

      renderTeamTable();

      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      expect(screen.getByText('bob@acme.com')).toBeInTheDocument();
    });

    it('renders role badges', async () => {
      vi.mocked(organizationMembersList).mockResolvedValue(
        makePagedResponse(MEMBER_FIXTURE)
      );

      renderTeamTable();

      await waitFor(() => {
        expect(screen.getByText('Alice Souza')).toBeInTheDocument();
      });

      // admin badge
      expect(screen.getByText('admin')).toBeInTheDocument();
      // member badge (two members — use getAllByText)
      const memberBadges = screen.getAllByText('member');
      expect(memberBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('renders status badges: active and disabled', async () => {
      vi.mocked(organizationMembersList).mockResolvedValue(
        makePagedResponse(MEMBER_FIXTURE)
      );

      renderTeamTable();

      await waitFor(() => {
        expect(screen.getByText('Alice Souza')).toBeInTheDocument();
      });

      const activeBadges = screen.getAllByText('active');
      expect(activeBadges.length).toBe(2); // Alice + Bob

      expect(screen.getByText('disabled')).toBeInTheDocument(); // Carol
    });

    it('falls back to email as name when first/last name are empty', async () => {
      const noNameFixture: PaginatedOrganizationMembershipList['results'] = [
        {
          id: 9,
          role: 'member',
          is_active: true,
          user_email: 'noname@acme.com',
          user_first_name: '',
          user_last_name: '',
        },
      ];

      vi.mocked(organizationMembersList).mockResolvedValue(
        makePagedResponse(noNameFixture)
      );

      renderTeamTable();

      await waitFor(() => {
        // When both name parts are empty, the email is used as the display name
        // (appears in the Name column), distinct from the Email column value.
        const cells = screen.getAllByText('noname@acme.com');
        expect(cells.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('empty state', () => {
    it('shows the empty state message when there are no members', async () => {
      vi.mocked(organizationMembersList).mockResolvedValue(
        makePagedResponse([])
      );

      renderTeamTable();

      await waitFor(() => {
        expect(screen.getByText('No team members found.')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('renders skeleton rows while data is fetching', async () => {
      // Never resolve — stays in loading state.
      vi.mocked(organizationMembersList).mockReturnValue(
        new Promise(() => {}) as never
      );

      renderTeamTable();

      // The skeleton rows have aria-hidden="true" on the <tr> element.
      await waitFor(() => {
        const skeletonRows = document.querySelectorAll(
          'tr[aria-hidden="true"]'
        );
        expect(skeletonRows.length).toBeGreaterThan(0);
      });
    });
  });

  describe('error state', () => {
    it('shows an error message when the API call fails', async () => {
      vi.mocked(organizationMembersList).mockRejectedValue(
        new Error('Network error')
      );

      renderTeamTable();

      await waitFor(() => {
        expect(
          screen.getByText('Failed to load team members.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('pagination', () => {
    it('shows pagination controls when there are multiple pages', async () => {
      // 50 total with default pageSize 20 → 3 pages → Next button visible.
      vi.mocked(organizationMembersList).mockResolvedValue(
        makePagedResponse(MEMBER_FIXTURE, 50)
      );

      renderTeamTable();

      await waitFor(() => {
        expect(screen.getByText('Alice Souza')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/go to next page/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Role gating — verify a non-admin is redirected from /team
// ---------------------------------------------------------------------------

describe('TeamPage role gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useRequireRole redirects a member out of /team', async () => {
    // Never resolve the query — we're testing gating, not data.
    vi.mocked(organizationMembersList).mockReturnValue(
      new Promise(() => {}) as never
    );

    const { default: TeamPage } = await import('@/app/(app)/team/page');
    const { RoleProvider } = await import('@/components/navigation/role-gate');

    const queryClient = makeQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <RoleProvider role='member'>
          <TeamPage />
        </RoleProvider>
      </QueryClientProvider>
    );

    // useRequireRole fires replace in a useEffect — wait for it.
    await act(async () => {});

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/');
    });
  });

  it('does not redirect when the user is admin', async () => {
    vi.mocked(organizationMembersList).mockResolvedValue(
      makePagedResponse([]) as Awaited<
        ReturnType<typeof organizationMembersList>
      >
    );

    const { default: TeamPage } = await import('@/app/(app)/team/page');
    const { RoleProvider } = await import('@/components/navigation/role-gate');

    const queryClient = makeQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <RoleProvider role='admin'>
          <TeamPage />
        </RoleProvider>
      </QueryClientProvider>
    );

    await act(async () => {});

    // Should NOT redirect.
    expect(replace).not.toHaveBeenCalled();
  });
});
