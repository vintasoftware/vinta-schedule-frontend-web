/**
 * SignupForm — the branded signup link fixes the organization name.
 *
 * The generic signup behavior (consent checkboxes, validation, payload shape)
 * is covered by `src/app/auth/signup/page.test.tsx`; this suite only covers
 * what the branded route adds.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const searchParamValues = new Map<string, string>();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => searchParamValues.get(key) ?? null,
  }),
}));

const mockSignUp = vi.fn();
vi.mock('@/hooks/authentication/use-sign-up', () => ({
  useSignUp: () => ({
    signUp: mockSignUp,
    signUpMutation: { isPending: false },
  }),
}));

vi.mock('@/hooks/authentication/use-auth-config', () => ({
  useAuthConfig: () => ({
    authConfig: { data: { socialaccount: { providers: [] } } },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('@/hooks/authentication/use-provider-login', () => ({
  useProviderLogin: () => ({
    providerLogin: vi.fn(),
    providerLoginMutation: { isPending: false },
  }),
}));

vi.mock('@/hooks/authentication/use-authentication-flow-control', () => ({
  useAuthenticationFlowControl: () => vi.fn(),
}));

import SignupForm from './signup-form';

function renderForm(props: Parameters<typeof SignupForm>[0] = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<SignupForm {...props} />, { wrapper });
}

function orgInput() {
  return screen.getByTestId('organization-name-input') as HTMLInputElement;
}

/** Fill everything except the organization name, then submit. */
function fillTheRestAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText('First name'), {
    target: { value: 'Ada' },
  });
  fireEvent.change(screen.getByPlaceholderText('Last name'), {
    target: { value: 'Lovelace' },
  });
  fireEvent.change(screen.getByPlaceholderText('Email'), {
    target: { value: 'ada@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Phone'), {
    target: { value: '+15551234567' },
  });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), {
    target: { value: 'Str0ng!pass' },
  });
  fireEvent.change(screen.getByPlaceholderText('Repeat password'), {
    target: { value: 'Str0ng!pass' },
  });
  fireEvent.click(screen.getByTestId('accepted-terms-checkbox'));
  fireEvent.click(screen.getByTestId('accepted-sms-consent-checkbox'));
  fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
}

describe('SignupForm — locked organization name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamValues.clear();
    mockSignUp.mockResolvedValue({ status: 200 });
  });

  it('pre-fills and disables the organization field', () => {
    renderForm({ lockedOrganizationName: 'Acme Scheduling' });

    expect(orgInput().value).toBe('Acme Scheduling');
    expect(orgInput()).toBeDisabled();
    expect(screen.getByText('Set by your sign-up link.')).toBeInTheDocument();
  });

  it('still submits the locked name — disabling greys the control, not the value', async () => {
    renderForm({ lockedOrganizationName: 'Acme Scheduling' });

    fillTheRestAndSubmit();

    await waitFor(() => expect(mockSignUp).toHaveBeenCalledTimes(1));
    expect(mockSignUp.mock.calls[0][0]).toMatchObject({
      organization_name: 'Acme Scheduling',
      email: 'ada@example.com',
    });
  });

  it('leaves the field empty and editable without a locked name', () => {
    renderForm();

    expect(orgInput().value).toBe('');
    expect(orgInput()).not.toBeDisabled();
    expect(
      screen.queryByText('Set by your sign-up link.')
    ).not.toBeInTheDocument();
  });

  it('hides the field entirely on the invite path, even when a name is locked', () => {
    searchParamValues.set('invite', 'invite-token');

    renderForm({ lockedOrganizationName: 'Acme Scheduling' });

    expect(
      screen.queryByTestId('organization-name-input')
    ).not.toBeInTheDocument();
  });

  it('mentions the organization in the intro copy', () => {
    renderForm({ lockedOrganizationName: 'Acme Scheduling' });

    expect(
      screen.getByText('Sign up to get started with Acme Scheduling.')
    ).toBeInTheDocument();
  });
});
