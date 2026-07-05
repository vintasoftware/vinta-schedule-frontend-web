/**
 * SignupPage tests (SMS MFA Consent Frontend — Phase 4).
 *
 * Covers:
 * - Both consent checkboxes render unchecked by default.
 * - Submitting with either checkbox unchecked shows that field's inline
 *   error and does NOT call the signup mutation.
 * - Submitting with both checked (and other fields valid) calls the signup
 *   mutation with a body containing accepted_terms: true and
 *   accepted_sms_consent: true.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — declared before module imports
// ---------------------------------------------------------------------------

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'email' ? null : null),
  }),
}));

const mockSignUp = vi.fn();
const mockSignUpMutation = { isPending: false };
vi.mock('@/hooks/authentication/use-sign-up', () => ({
  useSignUp: () => ({
    signUp: mockSignUp,
    signUpMutation: mockSignUpMutation,
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

const mockProviderLogin = vi.fn();
vi.mock('@/hooks/authentication/use-provider-login', () => ({
  useProviderLogin: () => ({
    providerLogin: mockProviderLogin,
    providerLoginMutation: { isPending: false },
  }),
}));

const mockAuthenticationFlowControl = vi.fn();
vi.mock('@/hooks/authentication/use-authentication-flow-control', () => ({
  useAuthenticationFlowControl: () => mockAuthenticationFlowControl,
}));

import SignupPage from './page';

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
  return render(<SignupPage />, { wrapper });
}

function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText('First name'), {
    target: { value: 'Ada' },
  });
  fireEvent.change(screen.getByPlaceholderText('Last name'), {
    target: { value: 'Lovelace' },
  });
  fireEvent.change(screen.getByPlaceholderText('Your organization'), {
    target: { value: 'Acme Inc' },
  });
  fireEvent.change(screen.getByPlaceholderText('Email'), {
    target: { value: 'ada@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Phone'), {
    target: { value: '14155552671' },
  });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), {
    target: { value: 'Str0ng!Pass' },
  });
  fireEvent.change(screen.getByPlaceholderText('Repeat password'), {
    target: { value: 'Str0ng!Pass' },
  });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SignupPage — consent checkboxes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both consent checkboxes unchecked by default', async () => {
    renderPage();
    const termsCheckbox = await screen.findByTestId('accepted-terms-checkbox');
    const smsCheckbox = screen.getByTestId('accepted-sms-consent-checkbox');
    expect(termsCheckbox).not.toBeChecked();
    expect(smsCheckbox).not.toBeChecked();
  });

  it('links the terms checkbox copy to /privacy and /terms', async () => {
    renderPage();
    await screen.findByTestId('accepted-terms-checkbox');
    expect(
      screen.getByRole('link', { name: 'Privacy Policy' })
    ).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute(
      'href',
      '/terms'
    );
  });

  it('blocks submission and shows an inline error when accepted_terms is unchecked', async () => {
    renderPage();
    await screen.findByTestId('accepted-terms-checkbox');
    fillRequiredFields();
    // Only check the SMS consent box.
    fireEvent.click(screen.getByTestId('accepted-sms-consent-checkbox'));
    submit();

    expect(
      await screen.findByText(
        /you must agree to the privacy policy and terms of use/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText('You must agree to receive SMS messages.')
    ).not.toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('blocks submission and shows an inline error when accepted_sms_consent is unchecked', async () => {
    renderPage();
    await screen.findByTestId('accepted-terms-checkbox');
    fillRequiredFields();
    // Only check the terms box.
    fireEvent.click(screen.getByTestId('accepted-terms-checkbox'));
    submit();

    expect(
      await screen.findByText(/you must agree to receive sms messages/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'You must agree to the Privacy Policy and Terms of Use.'
      )
    ).not.toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('calls the signup mutation with accepted_terms and accepted_sms_consent set to true when both are checked', async () => {
    mockSignUp.mockResolvedValue({ status: 200, data: {} });
    renderPage();
    await screen.findByTestId('accepted-terms-checkbox');
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('accepted-terms-checkbox'));
    fireEvent.click(screen.getByTestId('accepted-sms-consent-checkbox'));
    submit();

    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        accepted_terms: true,
        accepted_sms_consent: true,
      })
    );
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.not.objectContaining({ confirm_password: expect.anything() })
    );
  });
});
