import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { SocialAccountsSection } from './social-accounts-section';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const BASE = 'http://localhost:8000/auth/app/v1';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const GOOGLE = { id: 'google', name: 'Google', flows: ['provider_redirect'] };
const APPLE = { id: 'apple', name: 'Apple', flows: ['provider_redirect'] };

const LINKED_GOOGLE = {
  display: 'ada@gmail.com',
  uid: 'google-uid-1',
  provider: GOOGLE,
};

let disconnectResponse: () => Response;

function installFetch() {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request;
    const method = request.method.toUpperCase();
    if (request.url.startsWith(`${BASE}/config`)) {
      return jsonResponse(200, {
        status: 200,
        data: { socialaccount: { providers: [GOOGLE, APPLE] } },
      });
    }
    if (
      request.url.startsWith(`${BASE}/account/providers`) &&
      method === 'GET'
    ) {
      return jsonResponse(200, { status: 200, data: [LINKED_GOOGLE] });
    }
    if (
      request.url.startsWith(`${BASE}/account/providers`) &&
      method === 'DELETE'
    ) {
      return disconnectResponse();
    }
    if (request.url.startsWith(`${BASE}/auth/session`)) {
      return jsonResponse(200, {
        status: 200,
        data: { user: { id: 1, has_usable_password: false } },
        meta: { is_authenticated: true },
      });
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
  return render(<SocialAccountsSection />, { wrapper: Wrapper });
}

describe('SocialAccountsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFetch();
  });

  it('drives the provider list from the allauth config', async () => {
    renderSection();

    expect(await screen.findByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
    // Google is linked → shows the account, no Connect button for it.
    expect(screen.getByText('ada@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    // Apple is not linked → offers Connect.
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
  });

  it('surfaces the last-login-method error with a set-a-password hint', async () => {
    const user = userEvent.setup();
    disconnectResponse = () =>
      jsonResponse(400, {
        status: 400,
        errors: [
          {
            code: 'last_login_method',
            message: 'You cannot disconnect your last login method.',
          },
        ],
      });
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Disconnect' }));
    // Confirm in the alert dialog.
    const dialog = await screen.findByRole('alertdialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Disconnect' })
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'You cannot disconnect your last login method. Set a password first so you can still log in.'
      )
    );
  });
});
