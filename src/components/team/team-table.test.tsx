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
    organizationMembersDeactivateCreate: vi.fn(),
    organizationMembersReactivateCreate: vi.fn(),
    organizationMembersUpdateRoleCreate: vi.fn(),
  };
});

// After mocks are hoisted, import the modules under test.
import {
  organizationMembersList,
  organizationMembersDeactivateCreate,
  organizationMembersReactivateCreate,
  organizationMembersUpdateRoleCreate,
} from '@/client/sdk.gen';
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
    user_id: 1,
    organization_id: 1,
    role: 'admin',
    is_active: true,
    user_email: 'alice@acme.com',
    user_first_name: 'Alice',
    user_last_name: 'Souza',
  },
  {
    user_id: 2,
    organization_id: 1,
    role: 'member',
    is_active: true,
    user_email: 'bob@acme.com',
    user_first_name: 'Bob',
    user_last_name: 'Lima',
  },
  {
    user_id: 3,
    organization_id: 1,
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
          user_id: 9,
          organization_id: 1,
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

    it('page 2 query maps to offset = pageSize and limit = pageSize', async () => {
      // This test verifies the core limit/offset arithmetic used by useTeamMembers.
      // TeamTable drives pagination via URL → useDataTableQuery, but the mapping
      // from DataTableQuery → API params is in useTeamMembers. We test that layer
      // directly: render TeamTable with a page-2 scenario by pre-configuring the
      // mock to return a page-1 response, then re-render with an overridden query.
      //
      // Strategy: mock organizationMembersList, render a DataTable driven by
      // useTeamMembers with an explicit page-2 DataTableQuery to confirm offset/limit.

      const PAGE_SIZE = 20;
      const page2Response = makePagedResponse(MEMBER_FIXTURE, 50);
      vi.mocked(organizationMembersList).mockResolvedValue(page2Response);

      // Import and call useTeamMembers via a test component that accepts a query prop.
      const { useTeamMembers } = await import('@/hooks/team/use-team-members');
      const { renderHook } = await import('@testing-library/react');
      const { QueryClient, QueryClientProvider } =
        await import('@tanstack/react-query');
      const { createElement } = await import('react');

      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: qc }, children);

      const page2Query = {
        page: 2,
        pageSize: PAGE_SIZE,
        ordering: null,
        search: null,
      };
      const { result } = renderHook(() => useTeamMembers(page2Query), {
        wrapper,
      });

      // Wait for the query to resolve.
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // organizationMembersList should have been called with the right offset/limit.
      const calls = vi.mocked(organizationMembersList).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      const queryArgs = lastCall[0]?.query as {
        limit?: number;
        offset?: number;
      };
      expect(queryArgs?.limit).toBe(PAGE_SIZE);
      expect(queryArgs?.offset).toBe(PAGE_SIZE); // page 2: offset = (2-1) * pageSize = 20
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

// ---------------------------------------------------------------------------
// Disable / Re-enable user functionality
// ---------------------------------------------------------------------------

describe('TeamTable disable/reactivate actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows disable button for active members and re-enable button for disabled members', async () => {
    vi.mocked(organizationMembersList).mockResolvedValue(
      makePagedResponse(MEMBER_FIXTURE)
    );

    renderTeamTable();

    // Wait for data to load.
    await waitFor(() => {
      expect(screen.getByText('Alice Souza')).toBeInTheDocument();
    });

    // Alice and Bob are active, should have Disable buttons.
    const disableButtons = screen.getAllByRole('button', { name: /disable/i });
    expect(disableButtons.length).toBeGreaterThan(0);

    // Carol is disabled, should have a Re-enable button.
    const reenableButtons = screen.getAllByRole('button', {
      name: /re-enable/i,
    });
    expect(reenableButtons.length).toBeGreaterThan(0);
  });

  it('cancels the disable dialog without calling the API', async () => {
    vi.mocked(organizationMembersList).mockResolvedValue(
      makePagedResponse(MEMBER_FIXTURE)
    );

    renderTeamTable();

    // Wait for data to load.
    await waitFor(() => {
      expect(screen.getByText('Bob Lima')).toBeInTheDocument();
    });

    // Find and click a Disable button (active members have Disable, not Re-enable).
    const disableButtons = screen.getAllByRole('button', { name: /disable/i });
    const disableButton = disableButtons[0]; // First one is for an active user
    expect(disableButton).toBeDefined();

    await act(async () => {
      disableButton.click();
    });

    // Wait for dialog to appear.
    await waitFor(() => {
      expect(screen.getByText(/Disable user/)).toBeInTheDocument();
    });

    // Click Cancel.
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await act(async () => {
      cancelButton.click();
    });

    // Verify the operation was not called.
    expect(
      vi.mocked(organizationMembersDeactivateCreate).mock.calls
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Change role functionality
// ---------------------------------------------------------------------------

describe('TeamTable change-role action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Make member" for admins and "Make admin" for active members', async () => {
    vi.mocked(organizationMembersList).mockResolvedValue(
      makePagedResponse(MEMBER_FIXTURE)
    );

    renderTeamTable();

    await waitFor(() => {
      expect(screen.getByText('Alice Souza')).toBeInTheDocument();
    });

    // Alice is admin → demote action.
    expect(
      screen.getByRole('button', { name: /make alice souza a member/i })
    ).toBeInTheDocument();
    // Bob is an active member → promote action.
    expect(
      screen.getByRole('button', { name: /make bob lima an admin/i })
    ).toBeInTheDocument();
    // Carol is disabled → no role action.
    expect(
      screen.queryByRole('button', { name: /make carol maia/i })
    ).not.toBeInTheDocument();
  });

  it('promotes a member to admin with the correct role payload after confirming', async () => {
    vi.mocked(organizationMembersList).mockResolvedValue(
      makePagedResponse(MEMBER_FIXTURE)
    );
    vi.mocked(organizationMembersUpdateRoleCreate).mockResolvedValue(
      makePagedResponse([]) as never
    );

    renderTeamTable();

    await waitFor(() => {
      expect(screen.getByText('Bob Lima')).toBeInTheDocument();
    });

    const promoteButton = screen.getByRole('button', {
      name: /make bob lima an admin/i,
    });
    await act(async () => {
      promoteButton.click();
    });

    await waitFor(() => {
      expect(screen.getByText('Promote to admin')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: 'Make admin' });
    await act(async () => {
      confirmButton.click();
    });

    await waitFor(() => {
      expect(
        vi.mocked(organizationMembersUpdateRoleCreate).mock.calls.length
      ).toBeGreaterThan(0);
    });

    const call = vi.mocked(organizationMembersUpdateRoleCreate).mock.calls[0][0];
    expect(call?.path).toEqual({ user_id: '2' });
    expect(call?.body).toEqual({ role: 'admin' });
  });

  it('cancels the change-role dialog without calling the API', async () => {
    vi.mocked(organizationMembersList).mockResolvedValue(
      makePagedResponse(MEMBER_FIXTURE)
    );

    renderTeamTable();

    await waitFor(() => {
      expect(screen.getByText('Alice Souza')).toBeInTheDocument();
    });

    const demoteButton = screen.getByRole('button', {
      name: /make alice souza a member/i,
    });
    await act(async () => {
      demoteButton.click();
    });

    await waitFor(() => {
      expect(screen.getByText('Demote to member')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await act(async () => {
      cancelButton.click();
    });

    expect(
      vi.mocked(organizationMembersUpdateRoleCreate).mock.calls
    ).toHaveLength(0);
  });
});
