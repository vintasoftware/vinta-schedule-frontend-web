import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { PaginatedOrganizationInvitationList } from '@/client';

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

// The generated invitationsListOptions (in @/client/@tanstack/react-query.gen)
// internally calls invitationsList from @/client/sdk.gen.
// We mock at the sdk.gen boundary so both the TanStack options factory AND any
// direct callers are intercepted.
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    invitationsList: vi.fn(),
  };
});

// After mocks are hoisted, import the modules under test.
import { invitationsList } from '@/client/sdk.gen';
import { InvitationsTable } from './invitations-table';

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

function renderInvitationsTable() {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<InvitationsTable />, { wrapper });
}

function makePagedResponse(
  results: PaginatedOrganizationInvitationList['results'],
  count = results.length
) {
  const body: PaginatedOrganizationInvitationList = {
    count,
    results,
  };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof invitationsList>>;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const INVITATION_FIXTURE: PaginatedOrganizationInvitationList['results'] = [
  {
    id: 1,
    email: 'alice@acme.com',
    first_name: 'Alice',
    last_name: 'Souza',
    organization: 1,
    invited_by: 10,
    accepted_at: null, // pending
    expires_at: '2025-12-31T23:59:59Z',
    created: '2025-06-01T00:00:00Z',
    modified: '2025-06-01T00:00:00Z',
  },
  {
    id: 2,
    email: 'bob@acme.com',
    first_name: 'Bob',
    last_name: 'Lima',
    organization: 1,
    invited_by: 10,
    accepted_at: null, // pending
    expires_at: '2025-12-25T23:59:59Z',
    created: '2025-06-02T00:00:00Z',
    modified: '2025-06-02T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvitationsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('pending-only filtering', () => {
    it('renders pending invitation rows and always passes is_accepted: false', async () => {
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE)
      );

      renderInvitationsTable();

      // Wait for data to load (skeleton → rows).
      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      expect(screen.getByText('bob@acme.com')).toBeInTheDocument();

      // Verify that the op was called with is_accepted: false
      const calls = vi.mocked(invitationsList).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      const queryArgs = lastCall[0]?.query as {
        is_accepted?: boolean;
      };
      expect(queryArgs?.is_accepted).toBe(false);
    });

    it('shows expiry dates formatted as dates', async () => {
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE)
      );

      renderInvitationsTable();

      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      // Expiry should be formatted as "Dec 31, 2025" (zonedFormat with UTC)
      expect(screen.getByText('Dec 31, 2025')).toBeInTheDocument();
      expect(screen.getByText('Dec 25, 2025')).toBeInTheDocument();
    });

    it('renders pending status badges', async () => {
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE)
      );

      renderInvitationsTable();

      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      const pendingBadges = screen.getAllByText('pending');
      expect(pendingBadges.length).toBe(2);
    });
  });

  describe('empty state', () => {
    it('shows the empty state message when there are no pending invitations', async () => {
      vi.mocked(invitationsList).mockResolvedValue(makePagedResponse([]));

      renderInvitationsTable();

      await waitFor(() => {
        expect(screen.getByText('No pending invitations.')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('renders skeleton rows while data is fetching', async () => {
      // Never resolve — stays in loading state.
      vi.mocked(invitationsList).mockReturnValue(
        new Promise(() => {}) as never
      );

      renderInvitationsTable();

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
      vi.mocked(invitationsList).mockRejectedValue(new Error('Network error'));

      renderInvitationsTable();

      await waitFor(() => {
        expect(
          screen.getByText('Failed to load invitations.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('search', () => {
    it('passes search query to email param', async () => {
      const mockResponse = makePagedResponse(INVITATION_FIXTURE);
      vi.mocked(invitationsList).mockResolvedValue(mockResponse);

      renderInvitationsTable();

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      // Clear the calls recorded so far
      vi.mocked(invitationsList).mockClear();

      // Simulate a search interaction by calling useInvitations with search set.
      // For simplicity, we'll just verify that when the hook receives a search query,
      // it gets passed to the email param. We do this by calling the hook directly.
      const { renderHook } = await import('@testing-library/react');
      const { useInvitations } =
        await import('@/hooks/invitations/use-invitations');
      const React = await import('react');
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: qc }, children);

      const query = {
        page: 1,
        pageSize: 20,
        ordering: null,
        search: 'alice', // Search for a specific email substring
      };

      vi.mocked(invitationsList).mockResolvedValue(mockResponse);
      const { result } = renderHook(() => useInvitations(query), { wrapper });

      // Wait for the query to resolve.
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify invitationsList was called with email set to the search term
      const calls = vi.mocked(invitationsList).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      const queryArgs = lastCall[0]?.query as {
        email?: string;
      };
      expect(queryArgs?.email).toBe('alice');
    });
  });

  describe('pagination', () => {
    it('shows pagination controls when there are multiple pages', async () => {
      // 50 total with default pageSize 20 → 3 pages → Next button visible.
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE, 50)
      );

      renderInvitationsTable();

      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/go to next page/i)).toBeInTheDocument();
    });

    it('page 2 query maps to offset = pageSize and limit = pageSize', async () => {
      const PAGE_SIZE = 20;
      const page2Response = makePagedResponse(INVITATION_FIXTURE, 50);
      vi.mocked(invitationsList).mockResolvedValue(page2Response);

      const { useInvitations } =
        await import('@/hooks/invitations/use-invitations');
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
      const { result } = renderHook(() => useInvitations(page2Query), {
        wrapper,
      });

      // Wait for the query to resolve.
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // invitationsList should have been called with the right offset/limit.
      const calls = vi.mocked(invitationsList).mock.calls;
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
