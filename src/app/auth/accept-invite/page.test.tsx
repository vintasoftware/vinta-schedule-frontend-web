/**
 * AcceptInvitePage tests (Phase 7 — UC4b).
 *
 * Covers:
 * - Form renders with heading and submit button.
 * - On successful accept, router.replace('/') is called.
 * - Already-member error (same-org duplicate) shows the friendly message and
 *   does NOT redirect.
 * - Generic error shows the error alert and does NOT redirect.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — declared before module imports
// ---------------------------------------------------------------------------

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => ({ get: () => null }),
}));

const mockAcceptInvitation = vi.fn();
const mockAcceptInvitationMutation = { isPending: false };

vi.mock('@/hooks/organizations/use-accept-invitation', () => ({
  useAcceptInvitation: () => ({
    acceptInvitation: mockAcceptInvitation,
    acceptInvitationMutation: mockAcceptInvitationMutation,
  }),
  isAlreadyMemberError: (err: unknown) => {
    if (err && typeof err === 'object' && 'code' in err) {
      return (err as { code?: unknown }).code === 'user_already_has_membership';
    }
    if (err && typeof err === 'object' && 'error' in err) {
      return (
        (err as { error?: unknown }).error ===
        'User is already a member of this organization.'
      );
    }
    return false;
  },
  getAcceptInvitationErrorMessage: (err: unknown) => {
    if (err && typeof err === 'object' && 'error' in err) {
      const msg = (err as { error?: unknown }).error;
      if (typeof msg === 'string') return msg;
    }
    if (err instanceof Error) return err.message;
    return 'Could not accept the invitation.';
  },
}));

import AcceptInvitePage from './page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderPage() {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<AcceptInvitePage />, { wrapper });
}

async function fillTokenAndSubmit(token: string) {
  const input = screen.getByRole('textbox', { name: /invitation token/i });
  fireEvent.change(input, { target: { value: token } });
  fireEvent.click(screen.getByRole('button', { name: /accept invitation/i }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AcceptInvitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form heading and submit button', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /accept invitation/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /accept invitation/i })
    ).toBeInTheDocument();
  });

  it('blocks submission when token is empty (client-side validation)', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /accept invitation/i }));
    expect(
      await screen.findByText(/invitation token is required/i)
    ).toBeInTheDocument();
    expect(mockAcceptInvitation).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  describe('successful accept (UC4b)', () => {
    beforeEach(() => {
      mockAcceptInvitation.mockResolvedValue({ token: 'tok' });
    });

    it('calls acceptInvitation with the entered token', async () => {
      renderPage();
      await fillTokenAndSubmit('my-invite-token');
      await waitFor(() =>
        expect(mockAcceptInvitation).toHaveBeenCalledWith({
          token: 'my-invite-token',
        })
      );
    });

    it('redirects to / after successful accept', async () => {
      renderPage();
      await fillTokenAndSubmit('my-invite-token');
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    });
  });

  describe('already-member error (same-org duplicate)', () => {
    const alreadyMemberError = {
      error: 'User is already a member of this organization.',
    };

    beforeEach(() => {
      mockAcceptInvitation.mockRejectedValue(alreadyMemberError);
    });

    it('shows the already-member alert and does NOT redirect', async () => {
      renderPage();
      await fillTokenAndSubmit('dup-token');
      expect(
        await screen.findByText(/already a member of this organization/i)
      ).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it('shows a Go to the app link in the already-member alert', async () => {
      renderPage();
      await fillTokenAndSubmit('dup-token');
      expect(
        await screen.findByRole('link', { name: /go to the app/i })
      ).toBeInTheDocument();
    });

    it('does NOT show the generic error alert when already-member error occurs', async () => {
      renderPage();
      await fillTokenAndSubmit('dup-token');
      await screen.findByText(/already a member of this organization/i);
      expect(
        screen.queryByText(/could not accept invitation/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('generic error', () => {
    const genericError = { error: 'Token not found.' };

    beforeEach(() => {
      mockAcceptInvitation.mockRejectedValue(genericError);
    });

    it('shows the generic error alert and does NOT redirect', async () => {
      renderPage();
      await fillTokenAndSubmit('bad-token');
      expect(await screen.findByText(/token not found/i)).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });
  });
});
