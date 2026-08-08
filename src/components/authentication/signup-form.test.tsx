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

const mockAuthenticationFlowControl = vi.fn();

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
  useAuthenticationFlowControl: () => mockAuthenticationFlowControl,
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

/**
 * Fill every field and submit. Organization name and email are filled only
 * when the link left them editable — a locked field already carries its value.
 */
function fillTheRestAndSubmit({ phone = '+14155552671' } = {}) {
  const org = screen.queryByTestId('organization-name-input');
  if (org && !(org as HTMLInputElement).disabled) {
    fireEvent.change(org, { target: { value: 'Analytical Engines' } });
  }
  const email = screen.getByTestId('email-input') as HTMLInputElement;
  if (!email.disabled) {
    fireEvent.change(email, { target: { value: 'ada@example.com' } });
  }
  fireEvent.change(screen.getByPlaceholderText('First name'), {
    target: { value: 'Ada' },
  });
  fireEvent.change(screen.getByPlaceholderText('Last name'), {
    target: { value: 'Lovelace' },
  });
  fireEvent.change(screen.getByPlaceholderText('+14155552671'), {
    target: { value: phone },
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

describe('SignupForm — invited email is locked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamValues.clear();
    mockSignUp.mockResolvedValue({ status: 200 });
  });

  function emailInput() {
    return screen.getByTestId('email-input') as HTMLInputElement;
  }

  it('pre-fills and disables the email on the invite path', () => {
    searchParamValues.set('invite', 'invite-token');
    searchParamValues.set('email', 'ada@invited.example.com');

    renderForm();

    expect(emailInput().value).toBe('ada@invited.example.com');
    expect(emailInput()).toBeDisabled();
    expect(screen.getByText('Set by your invitation.')).toBeInTheDocument();
  });

  it('still submits the invited address', async () => {
    searchParamValues.set('invite', 'invite-token');
    searchParamValues.set('email', 'ada@invited.example.com');

    renderForm();
    fillTheRestAndSubmit();

    await waitFor(() => expect(mockSignUp).toHaveBeenCalledTimes(1));
    expect(mockSignUp.mock.calls[0][0]).toMatchObject({
      email: 'ada@invited.example.com',
    });
  });

  it('leaves the email editable for self-service signup', () => {
    renderForm();

    expect(emailInput().value).toBe('');
    expect(emailInput()).not.toBeDisabled();
    expect(
      screen.queryByText('Set by your invitation.')
    ).not.toBeInTheDocument();
  });

  it('leaves the email editable when the invite link carries no address', () => {
    searchParamValues.set('invite', 'invite-token');

    renderForm();

    // Nothing to lock it to — locking an empty field would strand the visitor.
    expect(emailInput().value).toBe('');
    expect(emailInput()).not.toBeDisabled();
  });
});

describe('SignupForm — phone must be E.164', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamValues.clear();
    mockSignUp.mockResolvedValue({ status: 200 });
  });

  it.each([
    ['spaces', '+1 415 555 2671'],
    ['parentheses and dashes', '(415) 555-2671'],
    ['no country code', '4155552671'],
  ])('blocks submission for a number with %s', async (_label, value) => {
    renderForm();

    fillTheRestAndSubmit({ phone: value });

    // The client must reject what allauth's `^\+[1-9]\d{5,14}$` would reject,
    // instead of letting the user discover it from a server 400.
    expect(
      await screen.findByText(
        'Enter a phone number in international format, e.g. +14155552671'
      )
    ).toBeInTheDocument();
    await waitFor(() => expect(mockSignUp).not.toHaveBeenCalled());
  });

  it('accepts a valid E.164 number', async () => {
    renderForm();

    fillTheRestAndSubmit({ phone: '+442071838750' });

    await waitFor(() => expect(mockSignUp).toHaveBeenCalledTimes(1));
    expect(mockSignUp.mock.calls[0][0]).toMatchObject({
      phone: '+442071838750',
    });
  });
});

describe('SignupForm — server 400 stays on the form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamValues.clear();
  });

  it('renders a field-scoped 400 against its input and does not route away', async () => {
    mockSignUp.mockRejectedValue({
      status: 400,
      errors: [
        {
          code: 'invalid_phone',
          param: 'phone',
          message: 'Enter a phone number including country code (e.g. +1).',
        },
      ],
    });

    renderForm();
    fillTheRestAndSubmit();

    expect(
      await screen.findByText(
        'Enter a phone number including country code (e.g. +1).'
      )
    ).toBeInTheDocument();

    // The regression: handing a 400 to flow control cleared the session and
    // pushed the visitor to the social-signup error page.
    expect(mockAuthenticationFlowControl).not.toHaveBeenCalled();
  });

  it('reads errors nested under `data` as well', async () => {
    mockSignUp.mockRejectedValue({
      status: 400,
      data: {
        errors: [
          {
            code: 'email_taken',
            param: 'email',
            message: 'A user is already registered with this email address.',
          },
        ],
      },
    });

    renderForm();
    fillTheRestAndSubmit();

    expect(
      await screen.findByText(
        'A user is already registered with this email address.'
      )
    ).toBeInTheDocument();
    expect(mockAuthenticationFlowControl).not.toHaveBeenCalled();
  });

  it('shows an unparametrized 400 as a form-level alert', async () => {
    mockSignUp.mockRejectedValue({
      status: 400,
      errors: [{ code: 'invalid', message: 'Signup is currently closed.' }],
    });

    renderForm();
    fillTheRestAndSubmit();

    expect(
      await screen.findByText('Signup is currently closed.')
    ).toBeInTheDocument();
    expect(mockAuthenticationFlowControl).not.toHaveBeenCalled();
  });

  it('still hands a 401 staged response to flow control', async () => {
    const staged = {
      status: 401,
      data: { flows: [{ id: 'verify_email', is_pending: true }] },
      meta: { session_token: 'session' },
    };
    mockSignUp.mockRejectedValue(staged);

    renderForm();
    fillTheRestAndSubmit();

    // Signup succeeded; verify_email is the next step, not an error.
    await waitFor(() =>
      expect(mockAuthenticationFlowControl).toHaveBeenCalledWith(staged)
    );
    expect(screen.queryByText('Signup failed')).not.toBeInTheDocument();
  });
});
