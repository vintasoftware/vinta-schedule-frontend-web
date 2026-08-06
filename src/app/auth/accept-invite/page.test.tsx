/**
 * AcceptInvitePage tests (Phase 7 — UC4b).
 *
 * Covers:
 * - Form renders with heading and submit button (session already active).
 * - On successful accept, router.replace('/') is called.
 * - Already-member error (same-org duplicate) shows the friendly message and
 *   does NOT redirect.
 * - Generic error shows the error alert and does NOT redirect.
 * - No active session: gated to Log in / Sign up links (never calls
 *   acceptInvitation — that's what used to silently 401 and lose the token).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — declared before module imports
// ---------------------------------------------------------------------------

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/auth/accept-invite',
  useSearchParams: () => ({ get: () => null, toString: () => '' }),
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
    // Simulate an active session (the JS-readable flag `OnboardingGate` and
    // the accept-invite gate both check) unless a test opts out below.
    document.cookie = 'sessionActive=1; path=/';
  });

  afterEach(() => {
    document.cookie = 'sessionActive=; path=/; Max-Age=0';
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

  describe('no active session', () => {
    beforeEach(() => {
      // Override the top-level beforeEach: no `sessionActive` cookie set.
      document.cookie = 'sessionActive=; path=/; Max-Age=0';
    });

    // AuthNavbar always renders its own generic "Sign up" (and "Sign in")
    // link, so `getByRole('link', { name: /sign up/i })` alone is ambiguous —
    // disambiguate by the `next`-carrying href, which only the gate's CTA has.
    function getSignUpCta() {
      const nextTarget = encodeURIComponent('/auth/accept-invite');
      return screen
        .getAllByRole('link', { name: /sign up/i })
        .find((link) =>
          link.getAttribute('href')?.includes(`next=${nextTarget}`)
        );
    }

    it('shows Log in / Sign up links instead of the token form', () => {
      renderPage();
      expect(
        screen.getByRole('link', { name: /log in/i })
      ).toBeInTheDocument();
      expect(getSignUpCta()).toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', { name: /invitation token/i })
      ).not.toBeInTheDocument();
    });

    it('never calls acceptInvitation (the previous silent-401 bug)', () => {
      renderPage();
      expect(mockAcceptInvitation).not.toHaveBeenCalled();
    });

    it('points Log in / Sign up at this exact page via `next`', () => {
      renderPage();
      const nextTarget = encodeURIComponent('/auth/accept-invite');
      expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute(
        'href',
        `/auth/login?next=${nextTarget}`
      );
      expect(getSignUpCta()).toHaveAttribute(
        'href',
        `/auth/signup?next=${nextTarget}`
      );
    });
  });
});
