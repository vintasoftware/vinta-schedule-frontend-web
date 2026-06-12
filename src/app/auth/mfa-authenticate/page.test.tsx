import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// --- Mocks -----------------------------------------------------------------

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const storeAuthTokens = vi.fn();
vi.mock('@/lib/auth-server-actions', () => ({
  storeAuthTokens: (...args: unknown[]) => storeAuthTokens(...args),
  clearAuthCookies: vi.fn(),
}));

import MfaAuthenticatePage from './page';
import { configureClientAuthentication } from '@/lib/authentication-fetch-interceptors';
import { ClientTokenStorageStrategy } from '@/lib/token-storage-strategy.client';

// The session token travels via the shared auth-client interceptor in
// production — register it here so the test exercises the same path.
beforeAll(() => {
  configureClientAuthentication(new ClientTokenStorageStrategy());
});

const AUTHENTICATE_URL =
  'http://localhost:8000/auth/app/v1/auth/2fa/authenticate';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const AUTHENTICATED = {
  status: 200,
  data: { user: { id: 7 } },
  meta: {
    access_token: 'acc-token',
    refresh_token: 'ref-token',
    is_authenticated: true,
  },
};

let authenticateResponse: () => Response;
let sentSessionToken: string | null;

function installFetch() {
  sentSessionToken = null;
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request;
    if (request.url.startsWith(AUTHENTICATE_URL)) {
      sentSessionToken = request.headers.get('X-Session-Token');
      return authenticateResponse();
    }
    return jsonResponse(404, {});
  }) as typeof fetch;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return render(<MfaAuthenticatePage />, { wrapper: Wrapper });
}

describe('MfaAuthenticatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFetch();
  });

  it('submits the TOTP code and stores the issued tokens', async () => {
    const user = userEvent.setup();
    authenticateResponse = () => jsonResponse(200, AUTHENTICATED);
    renderPage();

    await user.type(screen.getByLabelText('Authenticator code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
    expect(storeAuthTokens).toHaveBeenCalledWith('acc-token', 'ref-token');
  });

  it('shows the backend error for an invalid code', async () => {
    const user = userEvent.setup();
    authenticateResponse = () =>
      jsonResponse(400, {
        status: 400,
        errors: [{ code: 'incorrect_code', message: 'Incorrect code.' }],
      });
    renderPage();

    await user.type(screen.getByLabelText('Authenticator code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Incorrect code.')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('accepts a recovery code via the toggle', async () => {
    const user = userEvent.setup();
    authenticateResponse = () => jsonResponse(200, AUTHENTICATED);
    localStorage.setItem('sessionToken', 'pending-mfa-session');
    renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Use a recovery code instead' })
    );
    await user.type(screen.getByLabelText('Recovery code'), 'abcd-efgh-ijkl');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
    expect(sentSessionToken).toBe('pending-mfa-session');
  });
});
