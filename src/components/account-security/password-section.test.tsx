import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { PasswordSection } from './password-section';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

// Controls whether the screen is in "set" or "change" mode.
const mockUseAuthUser = vi.fn();
vi.mock('@/hooks/authentication/use-auth-user', () => ({
  AUTH_SESSION_QUERY_KEY: ['session'],
  useAuthUser: () => mockUseAuthUser(),
}));

const PASSWORD_CHANGE_URL =
  'http://localhost:8000/auth/app/v1/account/password/change';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let lastBody: unknown;

function installFetch(response: () => Response) {
  lastBody = undefined;
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request;
    if (request.url.startsWith(PASSWORD_CHANGE_URL)) {
      lastBody = await request.clone().json();
      return response();
    }
    return jsonResponse(404, {});
  }) as typeof fetch;
}

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return render(<PasswordSection />, { wrapper: Wrapper });
}

describe('PasswordSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Set password" without a current-password field for social-signup users', () => {
    mockUseAuthUser.mockReturnValue({
      user: { has_usable_password: false },
      isLoading: false,
    });
    renderSection();

    expect(
      screen.getByRole('button', { name: 'Set password' })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
  });

  it('changes the password and sends current_password for password users', async () => {
    const user = userEvent.setup();
    mockUseAuthUser.mockReturnValue({
      user: { has_usable_password: true },
      isLoading: false,
    });
    installFetch(() => jsonResponse(200, { status: 200 }));
    renderSection();

    await user.type(screen.getByLabelText('Current password'), 'old-pass');
    await user.type(screen.getByLabelText('New password'), 'new-pass-123');
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'new-pass-123'
    );
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(lastBody).toEqual({
      current_password: 'old-pass',
      new_password: 'new-pass-123',
    });
  });

  it('maps allauth 400 param errors onto the form fields', async () => {
    const user = userEvent.setup();
    mockUseAuthUser.mockReturnValue({
      user: { has_usable_password: true },
      isLoading: false,
    });
    installFetch(() =>
      jsonResponse(400, {
        status: 400,
        errors: [
          {
            code: 'incorrect_password',
            message: 'Incorrect password.',
            param: 'current_password',
          },
        ],
      })
    );
    renderSection();

    await user.type(screen.getByLabelText('Current password'), 'wrong');
    await user.type(screen.getByLabelText('New password'), 'new-pass-123');
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'new-pass-123'
    );
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('Incorrect password.')).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
