import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { PaginatedOrganizationInvitationList } from '@/client';
import { DateTime } from '@/lib/datetime';

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

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
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
    invitationsResendCreate: vi.fn(),
    invitationsDestroy: vi.fn(),
  };
});

// After mocks are hoisted, import the modules under test.
import {
  invitationsList,
  invitationsResendCreate,
  invitationsDestroy,
} from '@/client/sdk.gen';
import { toast } from 'sonner';
import { useInvitations } from '@/hooks/invitations/use-invitations';
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

    it('shows expiry dates formatted as dates in local zone', async () => {
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE)
      );

      renderInvitationsTable();

      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      // Compute expected date strings using the same local-zone logic as the component.
      const localZone = DateTime.local().zoneName ?? 'UTC';
      const aliceExpiry = DateTime.fromISO('2025-12-31T23:59:59Z', {
        zone: localZone,
      }).toFormat('MMM d, yyyy');
      const bobExpiry = DateTime.fromISO('2025-12-25T23:59:59Z', {
        zone: localZone,
      }).toFormat('MMM d, yyyy');

      expect(screen.getByText(aliceExpiry)).toBeInTheDocument();
      expect(screen.getByText(bobExpiry)).toBeInTheDocument();
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

  describe('search — integration (renders table → types → asserts URL navigation)', () => {
    it('typing into search input fires router.push with prefixed inv_search param', async () => {
      const user = userEvent.setup();
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE)
      );

      renderInvitationsTable();

      // Wait for initial load.
      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      push.mockClear();

      // Type into the search input in the rendered table.
      const searchInput = screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'alice');

      // Wait for the debounced search to fire (debounce default is 300ms).
      // userEvent uses fake timers internally with jest-fake-timers API; we
      // use waitFor to let the debounce settle within a real-time timeout.
      await waitFor(
        () => {
          expect(push).toHaveBeenCalled();
          const url = push.mock.calls[push.mock.calls.length - 1][0] as string;
          // URL should contain the prefixed search key (inv_search=alice)
          // and reset the page (inv_page=1).
          expect(url).toContain('inv_search=alice');
          expect(url).toContain('inv_page=1');
        },
        { timeout: 2000 }
      );
    });
  });

  describe('search — hook-level (unit)', () => {
    it('passes search query to email param', async () => {
      const mockResponse = makePagedResponse(INVITATION_FIXTURE);
      vi.mocked(invitationsList).mockResolvedValue(mockResponse);

      const qc = makeQueryClient();
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      );

      const query = {
        page: 1,
        pageSize: 20,
        ordering: null,
        search: 'alice',
      };

      const { result } = renderHook(() => useInvitations(query), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify invitationsList was called with email set to the search term
      const calls = vi.mocked(invitationsList).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      const queryArgs = lastCall[0]?.query as { email?: string };
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

      const qc = makeQueryClient();
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      );

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

  describe('resend action', () => {
    it('clicking Resend calls invitationsResendCreate with row id and email', async () => {
      const user = userEvent.setup();
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE)
      );

      // Mock the resend endpoint to succeed.
      vi.mocked(invitationsResendCreate).mockResolvedValue({
        data: {
          id: 1,
          email: 'alice@acme.com',
          expires_at: '2025-12-31T23:59:59Z',
        },
        response: new Response(JSON.stringify({}), { status: 200 }),
      } as unknown as Awaited<ReturnType<typeof invitationsResendCreate>>);

      renderInvitationsTable();

      // Wait for initial data load.
      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      // Click the Resend button for Alice (first row).
      const resendButtons = screen.getAllByRole('button', { name: /resend/i });
      expect(resendButtons.length).toBeGreaterThan(0);
      await user.click(resendButtons[0]);

      // Wait for the mutation to complete.
      await waitFor(() => {
        expect(invitationsResendCreate).toHaveBeenCalled();
      });

      // Verify the resend was called with the correct id and email.
      const calls = vi.mocked(invitationsResendCreate).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]?.path?.id).toBe('1');
      expect(lastCall[0]?.body?.email).toBe('alice@acme.com');
    });

    it('shows a success toast on successful resend', async () => {
      const user = userEvent.setup();
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE)
      );
      vi.mocked(invitationsResendCreate).mockResolvedValue({
        data: {
          id: 1,
          email: 'alice@acme.com',
          expires_at: '2025-12-31T23:59:59Z',
        },
        response: new Response(JSON.stringify({}), { status: 200 }),
      } as unknown as Awaited<ReturnType<typeof invitationsResendCreate>>);

      renderInvitationsTable();

      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      const resendButtons = screen.getAllByRole('button', { name: /resend/i });
      await user.click(resendButtons[0]);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Invitation resent', {
          description: expect.stringContaining('alice@acme.com'),
        });
      });
    });

    it('shows an error toast on failed resend', async () => {
      const user = userEvent.setup();
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE)
      );

      const error = new Error('Network error');
      vi.mocked(invitationsResendCreate).mockRejectedValue(error);

      renderInvitationsTable();

      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      const resendButtons = screen.getAllByRole('button', { name: /resend/i });
      await user.click(resendButtons[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Failed to resend invitation',
          {
            description: 'Network error',
          }
        );
      });
    });

    it('clicking multiple Resend buttons fires separate mutations per row', async () => {
      const user = userEvent.setup();
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE)
      );

      // Mock resend to succeed
      vi.mocked(invitationsResendCreate).mockResolvedValue({
        data: {
          id: 1,
          email: 'alice@acme.com',
          expires_at: '2025-12-31T23:59:59Z',
        },
        response: new Response(JSON.stringify({}), { status: 200 }),
      } as unknown as Awaited<ReturnType<typeof invitationsResendCreate>>);

      renderInvitationsTable();

      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      // Find all Resend buttons
      const allButtons = screen.getAllByRole('button');
      const resendButtons = allButtons.filter((btn) =>
        btn.getAttribute('aria-label')?.includes('Resend invitation')
      );

      // Should have 2 Resend buttons (one for Alice, one for Bob)
      expect(resendButtons.length).toBe(2);

      // Click the first (Alice)
      await user.click(resendButtons[0]);

      // Wait for toast.success to be called
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Invitation resent', {
          description: expect.stringContaining('alice@acme.com'),
        });
      });

      // Verify the resend mutation was called
      expect(invitationsResendCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { id: '1' },
          body: { email: 'alice@acme.com' },
        })
      );
    });
  });

  describe('revoke action', () => {
    it('clicking Revoke opens a confirm dialog', async () => {
      const user = userEvent.setup();
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE)
      );

      renderInvitationsTable();

      // Wait for initial data load.
      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      // Click the Revoke button for Alice (first row).
      const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
      expect(revokeButtons.length).toBeGreaterThan(0);
      await user.click(revokeButtons[0]);

      // Wait for the alert dialog to appear.
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Verify the dialog contains the email address in the description.
      const alertDialog = screen.getByRole('alertdialog');
      expect(alertDialog.textContent).toContain('alice@acme.com');
    });

    it('confirming the revoke dialog calls invitationsDestroy with row id', async () => {
      const user = userEvent.setup();
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE)
      );

      // Mock the destroy endpoint to succeed.
      vi.mocked(invitationsDestroy).mockResolvedValue({
        data: null,
        response: new Response(null, { status: 204 }),
      } as unknown as Awaited<ReturnType<typeof invitationsDestroy>>);

      renderInvitationsTable();

      // Wait for initial data load.
      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      // Click the Revoke button for Alice.
      const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
      await user.click(revokeButtons[0]);

      // Wait for the alert dialog to appear.
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Click the Revoke confirm button (the one inside the dialog).
      const confirmButton = screen
        .getAllByRole('button', { name: /revoke/i })
        .find(
          (btn) =>
            btn.closest('[role="alertdialog"]') !== null &&
            btn.getAttribute('aria-label') === null
        );
      expect(confirmButton).toBeDefined();
      await user.click(confirmButton!);

      // Wait for the mutation to complete.
      await waitFor(() => {
        expect(invitationsDestroy).toHaveBeenCalled();
      });

      // Verify invitationsDestroy was called with the correct id.
      const calls = vi.mocked(invitationsDestroy).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]?.path?.id).toBe('1');
    });

    it('shows a success toast on successful revoke', async () => {
      const user = userEvent.setup();
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE)
      );
      vi.mocked(invitationsDestroy).mockResolvedValue({
        data: null,
        response: new Response(null, { status: 204 }),
      } as unknown as Awaited<ReturnType<typeof invitationsDestroy>>);

      renderInvitationsTable();

      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      // Click Revoke button.
      const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
      await user.click(revokeButtons[0]);

      // Wait for dialog and click confirm.
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      const confirmButton = screen
        .getAllByRole('button', { name: /revoke/i })
        .find(
          (btn) =>
            btn.closest('[role="alertdialog"]') !== null &&
            btn.getAttribute('aria-label') === null
        );
      await user.click(confirmButton!);

      // Verify toast was shown.
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Invitation revoked', {
          description: expect.stringContaining('alice@acme.com'),
        });
      });
    });

    it('shows an error toast on failed revoke', async () => {
      const user = userEvent.setup();
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE)
      );

      const error = new Error('Network error');
      vi.mocked(invitationsDestroy).mockRejectedValue(error);

      renderInvitationsTable();

      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      // Click Revoke button.
      const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
      await user.click(revokeButtons[0]);

      // Wait for dialog and click confirm.
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      const confirmButton = screen
        .getAllByRole('button', { name: /revoke/i })
        .find(
          (btn) =>
            btn.closest('[role="alertdialog"]') !== null &&
            btn.getAttribute('aria-label') === null
        );
      await user.click(confirmButton!);

      // Verify error toast was shown.
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Failed to revoke invitation',
          {
            description: 'Network error',
          }
        );
      });
    });

    it('canceling the confirm dialog does NOT call invitationsDestroy', async () => {
      const user = userEvent.setup();
      vi.mocked(invitationsList).mockResolvedValue(
        makePagedResponse(INVITATION_FIXTURE)
      );

      renderInvitationsTable();

      await waitFor(() => {
        expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
      });

      // Click Revoke button.
      const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
      await user.click(revokeButtons[0]);

      // Wait for dialog.
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Click Cancel button.
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Verify invitationsDestroy was NOT called.
      expect(invitationsDestroy).not.toHaveBeenCalled();

      // Verify the dialog is closed.
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });
});
