/**
 * FinishSignupForm tests (SMS MFA Consent Frontend — Phase 5).
 *
 * Covers:
 * - Both consent checkboxes render unchecked by default.
 * - Submitting with either checkbox unchecked shows that field's inline
 *   error and does NOT call the provider-signup mutation.
 * - Submitting with both checked (and other fields valid) calls the
 *   provider-signup mutation with a body containing accepted_terms: true and
 *   accepted_sms_consent: true.
 * - The existing `verify_phone` pending-flow handoff on 401 still routes
 *   through `useAuthenticationFlowControl` (no regression).
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
}));

const mockProviderSignup = vi.fn();
const mockProviderSignupMutation = { isPending: false };
vi.mock('@/hooks/authentication/use-provider-signup', () => ({
  useProviderSignup: () => ({
    providerSignup: mockProviderSignup,
    providerSignupMutation: mockProviderSignupMutation,
  }),
}));

vi.mock('@/hooks/authentication/use-provider-info', () => ({
  useProviderInfo: () => ({
    providerInfo: undefined,
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

const mockAuthenticationFlowControl = vi.fn();
vi.mock('@/hooks/authentication/use-authentication-flow-control', () => ({
  useAuthenticationFlowControl: () => mockAuthenticationFlowControl,
}));

import { FinishSignupForm } from './finish-signup-form';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderForm() {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<FinishSignupForm />, { wrapper });
}

function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText('First name'), {
    target: { value: 'Ada' },
  });
  fireEvent.change(screen.getByPlaceholderText('Last name'), {
    target: { value: 'Lovelace' },
  });
  fireEvent.change(screen.getByPlaceholderText('Email'), {
    target: { value: 'ada@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('+14155552671'), {
    target: { value: '+14155552671' },
  });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FinishSignupForm — consent checkboxes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both consent checkboxes unchecked by default', async () => {
    renderForm();
    const termsCheckbox = await screen.findByTestId('accepted-terms-checkbox');
    const smsCheckbox = screen.getByTestId('accepted-sms-consent-checkbox');
    expect(termsCheckbox).not.toBeChecked();
    expect(smsCheckbox).not.toBeChecked();
  });

  it('links the terms checkbox copy to /privacy and /terms', async () => {
    renderForm();
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
    renderForm();
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
    expect(mockProviderSignup).not.toHaveBeenCalled();
  });

  it('blocks submission and shows an inline error when accepted_sms_consent is unchecked', async () => {
    renderForm();
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
    expect(mockProviderSignup).not.toHaveBeenCalled();
  });

  it('calls providerSignup with accepted_terms and accepted_sms_consent set to true when both are checked', async () => {
    mockProviderSignup.mockResolvedValue({ status: 200, data: {} });
    renderForm();
    await screen.findByTestId('accepted-terms-checkbox');
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('accepted-terms-checkbox'));
    fireEvent.click(screen.getByTestId('accepted-sms-consent-checkbox'));
    submit();

    await waitFor(() => expect(mockProviderSignup).toHaveBeenCalled());
    expect(mockProviderSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        accepted_terms: true,
        accepted_sms_consent: true,
      })
    );
    expect(mockAuthenticationFlowControl).toHaveBeenCalledWith({
      status: 200,
      data: {},
    });
  });

  it('still hands off to the verify_phone pending-flow on a 401 authentication response (no regression)', async () => {
    const pendingResponse = {
      status: 401,
      meta: { session_token: 'rotated-token' },
      data: {
        flows: [{ id: 'verify_phone', is_pending: true }],
      },
    };
    mockProviderSignup.mockRejectedValue(pendingResponse);
    renderForm();
    await screen.findByTestId('accepted-terms-checkbox');
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('accepted-terms-checkbox'));
    fireEvent.click(screen.getByTestId('accepted-sms-consent-checkbox'));
    submit();

    await waitFor(() =>
      expect(mockAuthenticationFlowControl).toHaveBeenCalledWith(
        pendingResponse
      )
    );
    // No inline form-level error should be shown for the pending-flow handoff.
    expect(screen.queryByText('Signup failed')).not.toBeInTheDocument();
  });
});
