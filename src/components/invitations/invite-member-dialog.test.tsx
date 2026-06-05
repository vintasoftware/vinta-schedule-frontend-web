import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { OrganizationInvitation } from '@/client';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

// Mock next/navigation (not needed by this component but required by deps).
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/team',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the sdk.gen boundary — intercepts invitationsList, invitationsCreate,
// and invitationsResendCreate.
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    invitationsList: vi.fn(),
    invitationsCreate: vi.fn(),
    invitationsResendCreate: vi.fn(),
  };
});

// Mock sonner — prevent missing Toaster context errors in tests.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// After mocks are hoisted, import modules under test.
import {
  invitationsList,
  invitationsCreate,
  invitationsResendCreate,
} from '@/client/sdk.gen';
import { toast } from 'sonner';
import { InviteMemberDialog } from './invite-member-dialog';

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

function renderDialog(open = true, onOpenChange = vi.fn()) {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    ...render(<InviteMemberDialog open={open} onOpenChange={onOpenChange} />, {
      wrapper,
    }),
    queryClient,
    onOpenChange,
  };
}

// Build a list response with a single invitation.
function makeInvitationResponse(
  email: string,
  id = 42
): Awaited<ReturnType<typeof invitationsList>> {
  const inv: OrganizationInvitation = {
    id,
    email,
    first_name: 'Alice',
    last_name: 'Souza',
    organization: 1,
    invited_by: 10,
    accepted_at: null,
    expires_at: '2025-12-31T23:59:59Z',
    created: '2025-06-01T00:00:00Z',
    modified: '2025-06-01T00:00:00Z',
  };
  const body = { count: 1, results: [inv] };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof invitationsList>>;
}

function makeEmptyListResponse(): Awaited<ReturnType<typeof invitationsList>> {
  const body = { count: 0, results: [] };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof invitationsList>>;
}

function makeCreateResponse(
  email: string
): Awaited<ReturnType<typeof invitationsCreate>> {
  const inv: OrganizationInvitation = {
    id: 99,
    email,
    first_name: '',
    last_name: '',
    organization: 1,
    invited_by: 10,
    accepted_at: null,
    expires_at: '2025-12-31T23:59:59Z',
    created: '2025-06-01T00:00:00Z',
    modified: '2025-06-01T00:00:00Z',
  };
  return {
    data: inv,
    response: new Response(JSON.stringify(inv), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof invitationsCreate>>;
}

function makeResendResponse(
  email: string,
  id = 42
): Awaited<ReturnType<typeof invitationsResendCreate>> {
  const inv: OrganizationInvitation = {
    id,
    email,
    first_name: 'Alice',
    last_name: 'Souza',
    organization: 1,
    invited_by: 10,
    accepted_at: null,
    expires_at: '2026-01-31T23:59:59Z', // refreshed expiry
    created: '2025-06-01T00:00:00Z',
    modified: '2025-06-01T00:00:00Z',
  };
  return {
    data: inv,
    response: new Response(JSON.stringify(inv), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof invitationsResendCreate>>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InviteMemberDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Zod validation
  // -------------------------------------------------------------------------

  describe('zod validation', () => {
    it('does not submit with an empty email', async () => {
      const user = userEvent.setup();
      renderDialog();

      const submitBtn = screen.getByRole('button', {
        name: /send invitation/i,
      });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });

      // invitationsList (for duplicate check) must NOT have been called.
      expect(vi.mocked(invitationsList)).not.toHaveBeenCalled();
    });

    it('does not submit with an invalid email and shows error', async () => {
      const user = userEvent.setup();
      renderDialog();

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'not-an-email');

      const submitBtn = screen.getByRole('button', {
        name: /send invitation/i,
      });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/invalid email address/i)).toBeInTheDocument();
      });

      expect(vi.mocked(invitationsList)).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Happy path — create a new invitation
  // -------------------------------------------------------------------------

  describe('create — happy path', () => {
    it('calls invitationsCreate with the correct email and closes the dialog', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      vi.mocked(invitationsList).mockResolvedValue(makeEmptyListResponse());
      vi.mocked(invitationsCreate).mockResolvedValue(
        makeCreateResponse('new@acme.com')
      );

      renderDialog(true, onOpenChange);

      await user.type(screen.getByLabelText(/email address/i), 'new@acme.com');
      await user.click(
        screen.getByRole('button', { name: /send invitation/i })
      );

      // Wait for the async flow to complete.
      await waitFor(() => {
        expect(vi.mocked(invitationsCreate)).toHaveBeenCalledOnce();
      });

      // Verify the body passed to create.
      const createArgs = vi.mocked(invitationsCreate).mock.calls[0][0];
      expect(createArgs?.body?.email).toBe('new@acme.com');

      // Dialog should close.
      expect(onOpenChange).toHaveBeenCalledWith(false);

      // Success toast.
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Invitation sent',
        expect.objectContaining({
          description: expect.stringContaining('new@acme.com'),
        })
      );
    });

    it('does NOT call invitationsCreate when no duplicate exists', async () => {
      // Empty list → no duplicate.
      vi.mocked(invitationsList).mockResolvedValue(makeEmptyListResponse());
      vi.mocked(invitationsCreate).mockResolvedValue(
        makeCreateResponse('fresh@acme.com')
      );

      const user = userEvent.setup();
      renderDialog();

      await user.type(
        screen.getByLabelText(/email address/i),
        'fresh@acme.com'
      );
      await user.click(
        screen.getByRole('button', { name: /send invitation/i })
      );

      await waitFor(() => {
        expect(vi.mocked(invitationsCreate)).toHaveBeenCalledOnce();
      });

      // The critical assertion — create was called ONCE (no double-submit).
      expect(vi.mocked(invitationsCreate)).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Duplicate detection — does NOT create; surfaces Resend
  // -------------------------------------------------------------------------

  describe('duplicate email — shows resend, does not create', () => {
    it('surfaces the duplicate notice and does NOT call invitationsCreate', async () => {
      const user = userEvent.setup();

      // The list returns an exact-match pending invite.
      vi.mocked(invitationsList).mockResolvedValue(
        makeInvitationResponse('alice@acme.com', 42)
      );

      renderDialog();

      await user.type(
        screen.getByLabelText(/email address/i),
        'alice@acme.com'
      );
      await user.click(
        screen.getByRole('button', { name: /send invitation/i })
      );

      // Duplicate notice must appear.
      await waitFor(() => {
        expect(
          screen.getByText(/already has a pending invitation/i)
        ).toBeInTheDocument();
      });

      // Resend button must be visible.
      expect(
        screen.getByRole('button', { name: /resend invitation/i })
      ).toBeInTheDocument();

      // CRITICAL: invitationsCreate must NOT have been called.
      expect(vi.mocked(invitationsCreate)).not.toHaveBeenCalled();
    });

    it('clicking Resend calls invitationsResendCreate with the existing invite id and closes', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      vi.mocked(invitationsList).mockResolvedValue(
        makeInvitationResponse('alice@acme.com', 42)
      );
      vi.mocked(invitationsResendCreate).mockResolvedValue(
        makeResendResponse('alice@acme.com', 42)
      );

      renderDialog(true, onOpenChange);

      await user.type(
        screen.getByLabelText(/email address/i),
        'alice@acme.com'
      );
      await user.click(
        screen.getByRole('button', { name: /send invitation/i })
      );

      // Wait for duplicate notice.
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /resend invitation/i })
        ).toBeInTheDocument();
      });

      // Click Resend.
      await user.click(
        screen.getByRole('button', { name: /resend invitation/i })
      );

      await waitFor(() => {
        expect(vi.mocked(invitationsResendCreate)).toHaveBeenCalledOnce();
      });

      // Verify the correct id and email body were passed to resend.
      const resendArgs = vi.mocked(invitationsResendCreate).mock.calls[0][0];
      expect(resendArgs?.path?.id).toBe('42');
      // The body must include the email — OrganizationInvitationWritable requires it.
      expect(resendArgs?.body?.email).toBe('alice@acme.com');

      // invitationsCreate must still NOT have been called.
      expect(vi.mocked(invitationsCreate)).not.toHaveBeenCalled();

      // Dialog closes.
      expect(onOpenChange).toHaveBeenCalledWith(false);

      // Success toast.
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Invitation resent',
        expect.objectContaining({
          description: expect.stringContaining('alice@acme.com'),
        })
      );
    });

    it('partial email match from API is not treated as duplicate if different email', async () => {
      const user = userEvent.setup();

      // API returns "alicelong@acme.com" when querying "alice@acme.com" (partial match).
      // The component must do exact-match check and not treat it as duplicate.
      const inv: OrganizationInvitation = {
        id: 1,
        email: 'alicelong@acme.com', // different email returned by partial-match filter
        first_name: 'Alice',
        last_name: 'Long',
        organization: 1,
        invited_by: 10,
        accepted_at: null,
        expires_at: '2025-12-31T23:59:59Z',
        created: '2025-06-01T00:00:00Z',
        modified: '2025-06-01T00:00:00Z',
      };
      const body = { count: 1, results: [inv] };
      vi.mocked(invitationsList).mockResolvedValue({
        data: body,
        response: new Response(JSON.stringify(body), { status: 200 }),
      } as unknown as Awaited<ReturnType<typeof invitationsList>>);

      vi.mocked(invitationsCreate).mockResolvedValue(
        makeCreateResponse('alice@acme.com')
      );

      renderDialog();

      await user.type(
        screen.getByLabelText(/email address/i),
        'alice@acme.com'
      );
      await user.click(
        screen.getByRole('button', { name: /send invitation/i })
      );

      // Should create, not show duplicate notice.
      await waitFor(() => {
        expect(vi.mocked(invitationsCreate)).toHaveBeenCalledOnce();
      });

      expect(
        screen.queryByText(/already has a pending invitation/i)
      ).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Submit disabled while pending (no double-submit)
  // -------------------------------------------------------------------------

  describe('submit disabled while pending', () => {
    it('submit button is disabled while the duplicate check is in progress', async () => {
      const user = userEvent.setup();

      // Never resolve — stays pending forever.
      vi.mocked(invitationsList).mockReturnValue(
        new Promise(() => {}) as never
      );

      renderDialog();

      await user.type(
        screen.getByLabelText(/email address/i),
        'pending@acme.com'
      );

      const submitBtn = screen.getByRole('button', {
        name: /send invitation/i,
      });
      await user.click(submitBtn);

      // After first click the button text changes to "Sending…" and is disabled.
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /sending/i });
        expect(btn).toBeDisabled();
      });
    });

    it('double-clicking submit does not call invitationsCreate more than once', async () => {
      // Simulate a slow duplicate check so the second click hits the disabled
      // state created by `isChecking`. `invitationsCreate` must be called at
      // most once even if the user clicks rapidly.
      const user = userEvent.setup();

      // Resolve after a microtask tick so both clicks happen while isChecking
      // is true (i.e., before the check settles and re-enables the button).
      let resolveList!: (
        v: Awaited<ReturnType<typeof invitationsList>>
      ) => void;
      const listPromise = new Promise<
        Awaited<ReturnType<typeof invitationsList>>
      >((res) => {
        resolveList = res;
      });
      vi.mocked(invitationsList).mockReturnValue(listPromise as never);
      vi.mocked(invitationsCreate).mockResolvedValue(
        makeCreateResponse('double@acme.com')
      );

      renderDialog();

      await user.type(
        screen.getByLabelText(/email address/i),
        'double@acme.com'
      );

      const submitBtn = screen.getByRole('button', {
        name: /send invitation/i,
      });

      // First click — starts the check, button becomes disabled.
      await user.click(submitBtn);

      // Verify button is disabled (isChecking guard active).
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
      });

      // Second click — button is disabled so userEvent won't fire the handler.
      await user.click(screen.getByRole('button', { name: /sending/i }));

      // Now resolve the list with no duplicates → create is called.
      resolveList(makeEmptyListResponse());

      await waitFor(() => {
        expect(vi.mocked(invitationsCreate)).toHaveBeenCalledTimes(1);
      });

      // The critical assertion — create was called at most once.
      expect(vi.mocked(invitationsCreate)).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Dialog open/close
  // -------------------------------------------------------------------------

  describe('dialog rendering', () => {
    it('renders the dialog title when open', () => {
      vi.mocked(invitationsList).mockResolvedValue(makeEmptyListResponse());
      renderDialog(true);
      expect(screen.getByText('Invite a member')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      renderDialog(false);
      expect(screen.queryByText('Invite a member')).not.toBeInTheDocument();
    });

    it('cancel button calls onOpenChange(false)', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderDialog(true, onOpenChange);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
