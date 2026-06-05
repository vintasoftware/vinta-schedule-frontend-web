import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// --- Mocks -----------------------------------------------------------------

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

import ProviderSignupPage from './page';

const AUTH_BASE = 'http://localhost:8000';
const SIGNUP_URL = `${AUTH_BASE}/auth/app/v1/auth/provider/signup`;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Pending social login returned by GET /auth/provider/signup (prefill).
const PROVIDER_INFO = {
  status: 200,
  data: {
    user: { profile: { first_name: 'Ada', last_name: 'Lovelace' } },
    email: [{ email: 'ada@example.com', primary: true, verified: true }],
  },
};

// Successful completion: backend issues JWTs + user.
const AUTHENTICATED = {
  status: 200,
  data: { user: { id: 1, email: 'ada@example.com' } },
  meta: {
    access_token: 'acc-token',
    refresh_token: 'ref-token',
    session_token: 'final-session',
  },
};

// Signup accepted, but the new phone needs OTP verification before login.
const VERIFY_PHONE_PENDING = {
  status: 401,
  data: {
    flows: [{ id: 'login' }, { id: 'verify_phone', is_pending: true }],
  },
  meta: { is_authenticated: false, session_token: 'rotated-after-signup' },
};

let postBodies: Array<{ body: unknown; sessionToken: string | null }>;

function installFetch(signupPostResponse: () => Response) {
  postBodies = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request;
    const method = request.method.toUpperCase();
    if (request.url.startsWith(SIGNUP_URL) && method === 'GET') {
      return jsonResponse(200, PROVIDER_INFO);
    }
    if (request.url.startsWith(SIGNUP_URL) && method === 'POST') {
      postBodies.push({
        body: await request.clone().json(),
        sessionToken: request.headers.get('X-Session-Token'),
      });
      return signupPostResponse();
    }
    throw new Error(`Unexpected fetch: ${method} ${request.url}`);
  }) as unknown as typeof fetch;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<ProviderSignupPage />, { wrapper });
}

async function fillPhoneAndSubmit(phone: string) {
  const phoneInput = await screen.findByPlaceholderText('+14155552671');
  fireEvent.change(phoneInput, { target: { value: phone } });
  fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
}

describe('finish-signup page (pending social signup)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the phone-completion form without throwing', async () => {
    installFetch(() => jsonResponse(200, AUTHENTICATED));
    renderPage();
    expect(
      await screen.findByRole('heading', {
        name: /finish creating your account/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('+14155552671')).toBeInTheDocument();
  });

  it('completes signup and authenticates on a successful POST', async () => {
    // Callback rotated the session token into the cookie; page must bridge it.
    document.cookie = 'sessionToken=rotated-session; path=/';
    installFetch(() => jsonResponse(200, AUTHENTICATED));

    renderPage();
    // Wait for prefill so first/last/email validate.
    await waitFor(() =>
      expect(screen.getByDisplayValue('ada@example.com')).toBeInTheDocument()
    );

    await fillPhoneAndSubmit('+14155552671');

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
    expect(localStorage.getItem('accessToken')).toBe('acc-token');
    expect(localStorage.getItem('refreshToken')).toBe('ref-token');

    // X-Session-Token threaded from the rotated cookie.
    expect(postBodies[0]?.sessionToken).toBe('rotated-session');
    expect(postBodies[0]?.body).toMatchObject({
      email: 'ada@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone: '+14155552671',
    });
  });

  it('rejects a non-E.164 phone number before submitting', async () => {
    installFetch(() => jsonResponse(200, AUTHENTICATED));
    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue('ada@example.com')).toBeInTheDocument()
    );

    await fillPhoneAndSubmit('555-1234');

    expect(
      await screen.findByText(/international format/i)
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('routes to phone verification when signup returns a verify_phone pending 401', async () => {
    document.cookie = 'sessionToken=session-before-signup; path=/';
    installFetch(() => jsonResponse(401, VERIFY_PHONE_PENDING));

    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue('ada@example.com')).toBeInTheDocument()
    );

    await fillPhoneAndSubmit('+14155552671');

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/auth/verify-phone')
    );
    // Rotated token persisted for the verify-phone step (same session).
    expect(localStorage.getItem('sessionToken')).toBe('rotated-after-signup');
    // Not authenticated yet, and no spurious failure alert.
    expect(push).not.toHaveBeenCalledWith('/');
    expect(screen.queryByText(/signup failed/i)).not.toBeInTheDocument();
  });

  it('surfaces a 409 as "restart sign-in" instead of crashing', async () => {
    installFetch(() => jsonResponse(409, { status: 409 }));
    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue('ada@example.com')).toBeInTheDocument()
    );

    await fillPhoneAndSubmit('+14155552671');

    expect(
      await screen.findByRole('heading', { name: /sign-in expired/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /restart sign-in/i })
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith('/');
  });

  it('renders allauth field errors on a 400', async () => {
    installFetch(() =>
      jsonResponse(400, {
        status: 400,
        errors: [
          {
            code: 'invalid',
            param: 'phone',
            message: 'Enter a valid phone number.',
          },
        ],
      })
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByDisplayValue('ada@example.com')).toBeInTheDocument()
    );

    await fillPhoneAndSubmit('+14155552671');

    expect(
      await screen.findByText('Enter a valid phone number.')
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith('/');
  });
});
