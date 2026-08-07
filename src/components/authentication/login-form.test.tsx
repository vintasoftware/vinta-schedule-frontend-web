/**
 * LoginForm — `next` redirect coverage.
 *
 * On successful login, the form must redirect to a validated `?next=` path
 * when present (e.g. sent from the accept-invite gate) and fall back to
 * `/dashboard` otherwise. `next` is validated via `getSafeNextPath` — an
 * absolute or protocol-relative value must never be honored (open redirect).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
let nextParam: string | null = null;
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({ get: () => nextParam }),
}));

const mockLogin = vi.fn();
vi.mock('@/hooks/authentication/use-login', () => ({
  useLogin: () => ({
    login: mockLogin,
    loginMutation: { isPending: false },
  }),
}));

vi.mock('@/hooks/authentication/use-provider-login', () => ({
  useProviderLogin: () => ({
    providerLogin: vi.fn(),
    providerLoginMutation: { isPending: false },
  }),
}));

import LoginForm from './login-form';

async function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/email or phone/i), {
    target: { value: 'user@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'password123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^login$/i }));
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextParam = null;
    mockLogin.mockResolvedValue({});
  });

  it('redirects to /dashboard when there is no `next` param', async () => {
    render(<LoginForm socialProviders={[]} />);
    await fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
  });

  it('redirects to a valid relative `next` path after login', async () => {
    nextParam = '/o/acme/auth/accept-invite/?token=abc';
    render(<LoginForm socialProviders={[]} />);
    await fillAndSubmit();
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/o/acme/auth/accept-invite/?token=abc')
    );
  });

  it('falls back to /dashboard when `next` is an absolute/external URL', async () => {
    nextParam = 'https://evil.example.com/phish';
    render(<LoginForm socialProviders={[]} />);
    await fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
  });

  it('falls back to /dashboard when `next` is protocol-relative (//host)', async () => {
    nextParam = '//evil.example.com/phish';
    render(<LoginForm socialProviders={[]} />);
    await fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
  });
});
