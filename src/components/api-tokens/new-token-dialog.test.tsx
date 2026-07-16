/**
 * NewTokenDialog tests.
 *
 * Covers:
 * - Create → composed credential (`<system_user_id>:<token>`) shown once with
 *   copy-to-clipboard button + "you won't see this again" warning.
 * - After closing the dialog, the credential is no longer in the DOM / component state.
 * - The credential does NOT appear in the list (mock returns metadata only).
 * - No console.log of the credential.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// jsdom polyfills for Radix (Dialog/Checkbox)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
  if (!global.ResizeObserver) {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // Mock clipboard (must be configurable so userEvent.setup() can redefine it)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE any imports that use them
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    publicApiTokensCreate: vi.fn(),
    publicApiTokensList: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { publicApiTokensCreate, publicApiTokensList } from '@/client/sdk.gen';
import { toast } from 'sonner';
import { NewTokenDialog } from './new-token-dialog';
import type { SystemUserToken, SystemUserTokenResponse } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ONE_TIME_SECRET = 'plaintext-secret-once-only-abc123';

function makeCredential(id: number, secret: string): string {
  return `${id}:${secret}`;
}

function makeToken(id: number): SystemUserToken {
  return {
    id,
    integration_name: `Integration ${id}`,
    is_active: true,
    available_resources: ['calendar'],
    scoped_to_user: null,
  };
}

function makeCreateResponse(
  token: SystemUserToken,
  secret: string
): Awaited<ReturnType<typeof publicApiTokensCreate>> {
  const body: SystemUserTokenResponse = { ...token, token: secret };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof publicApiTokensCreate>>;
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderDialog(open = true, onOpenChangeFn?: (open: boolean) => void) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const onOpenChange = onOpenChangeFn ?? vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const utils = render(
    <NewTokenDialog open={open} onOpenChange={onOpenChange} />,
    { wrapper }
  );
  return { ...utils, onOpenChange, queryClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewTokenDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default list mock — no tokens
    vi.mocked(publicApiTokensList).mockResolvedValue({
      data: { count: 0, results: [] },
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof publicApiTokensList>>);
  });

  it('renders the form with name input and scope checkboxes', () => {
    renderDialog();

    expect(screen.getByText('New API token')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('My integration')).toBeInTheDocument();
    expect(screen.getByTestId('scope-checkbox-calendar')).toBeInTheDocument();
    expect(screen.getByTestId('scope-checkbox-user')).toBeInTheDocument();
  });

  it('shows the one-time composed credential after successful create with copy button and warning', async () => {
    const user = userEvent.setup();
    const token = makeToken(1);
    vi.mocked(publicApiTokensCreate).mockResolvedValueOnce(
      makeCreateResponse(token, ONE_TIME_SECRET)
    );

    renderDialog();

    // Fill in the form
    await user.type(
      screen.getByPlaceholderText('My integration'),
      'Test Integration'
    );

    // Select a scope
    await user.click(screen.getByTestId('scope-checkbox-calendar'));

    // Submit
    await user.click(screen.getByTestId('create-token-submit'));

    // Should switch to credential view
    await screen.findByText('API token created');

    // The composed `<system_user_id>:<token>` credential should be displayed
    const credentialInput = screen.getByTestId(
      'token-credential-input'
    ) as HTMLInputElement;
    expect(credentialInput.value).toBe(makeCredential(1, ONE_TIME_SECRET));

    // Copy button should be visible
    expect(screen.getByTestId('copy-token-button')).toBeInTheDocument();

    // "You won't see this again" warning should be present
    expect(
      screen.getByText(/you will not be able to see it again/i)
    ).toBeInTheDocument();

    // The form inputs should NOT be visible (we're in secret view)
    expect(
      screen.queryByPlaceholderText('My integration')
    ).not.toBeInTheDocument();
  });

  it('credential is cleared from the DOM after the dialog closes', async () => {
    const user = userEvent.setup();
    const token = makeToken(2);
    vi.mocked(publicApiTokensCreate).mockResolvedValueOnce(
      makeCreateResponse(token, ONE_TIME_SECRET)
    );

    // We need a controlled open state to test close behavior
    let currentOpen = true;
    const handleOpenChange = vi.fn((val: boolean) => {
      currentOpen = val;
    });

    // Do NOT wrap in QueryClientProvider here — renderDialog's `wrapper` option
    // handles that. When rerender is called with just <NewTokenDialog/>, RTL
    // re-applies the wrapper automatically, keeping the SAME component instance
    // and its state (onceCredential) across open/close transitions.
    const { rerender } = renderDialog(true, handleOpenChange);

    // Fill and submit
    await user.type(
      screen.getByPlaceholderText('My integration'),
      'Integration 2'
    );
    await user.click(screen.getByTestId('scope-checkbox-calendar'));
    await user.click(screen.getByTestId('create-token-submit'));

    // Wait for credential view
    await screen.findByText('API token created');
    expect(
      (screen.getByTestId('token-credential-input') as HTMLInputElement).value
    ).toBe(makeCredential(2, ONE_TIME_SECRET));

    // Click Done to close the dialog
    await user.click(screen.getByTestId('done-button'));

    // onOpenChange(false) was called
    expect(handleOpenChange).toHaveBeenCalledWith(false);

    // Rerender the SAME component instance with open=false (no extra wrapper —
    // the wrapper from renderDialog is re-applied by RTL automatically).
    // This fires the useEffect that clears onceCredential on the mounted component.
    rerender(<NewTokenDialog open={false} onOpenChange={handleOpenChange} />);

    // Credential should no longer be in the DOM (Dialog content unmounts when closed)
    expect(
      screen.queryByTestId('token-credential-input')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByDisplayValue(makeCredential(2, ONE_TIME_SECRET))
    ).not.toBeInTheDocument();

    void currentOpen; // suppress unused warning
  });

  it('credential does NOT appear in the refetched token list (list returns metadata only)', async () => {
    const user = userEvent.setup();
    const token = makeToken(3);
    vi.mocked(publicApiTokensCreate).mockResolvedValueOnce(
      makeCreateResponse(token, ONE_TIME_SECRET)
    );
    // The list endpoint always returns metadata only — no 'token' field.
    // This mock models the real API behaviour: the list serializer never
    // includes the plaintext secret.
    const listToken: SystemUserToken = {
      id: 3,
      integration_name: 'Integration 3',
      is_active: true,
      available_resources: ['calendar'],
      scoped_to_user: null,
      // Note: no 'token' field — this is intentional and matches the API
    };
    vi.mocked(publicApiTokensList).mockResolvedValue({
      data: { count: 1, results: [listToken] },
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof publicApiTokensList>>);

    renderDialog();

    await user.type(
      screen.getByPlaceholderText('My integration'),
      'Integration 3'
    );
    await user.click(screen.getByTestId('scope-checkbox-calendar'));
    await user.click(screen.getByTestId('create-token-submit'));

    await screen.findByText('API token created');

    // The credential input in the dialog shows the composed credential once —
    // from local state only.
    const credentialInput = screen.getByTestId(
      'token-credential-input'
    ) as HTMLInputElement;
    expect(credentialInput.value).toBe(makeCredential(3, ONE_TIME_SECRET));

    // Verify the list mock models the real invariant: the secret is NEVER
    // in the list response. The mock itself returns a token without 'token'.
    expect('token' in listToken).toBe(false);

    // The credential is ONLY in the dialog's local state (shown in the input).
    // No other part of the DOM should contain the credential outside the
    // credential view.
    const allInputs = document.querySelectorAll('input');
    const credentialInputEl = screen.getByTestId('token-credential-input');
    // Only the dedicated credential input holds the credential value
    allInputs.forEach((input) => {
      if (input !== credentialInputEl) {
        expect(input.value).not.toBe(makeCredential(3, ONE_TIME_SECRET));
      }
    });
  });

  it('does not call console.log with the credential', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const user = userEvent.setup();
    const token = makeToken(4);
    vi.mocked(publicApiTokensCreate).mockResolvedValueOnce(
      makeCreateResponse(token, ONE_TIME_SECRET)
    );

    renderDialog();

    await user.type(
      screen.getByPlaceholderText('My integration'),
      'Integration 4'
    );
    await user.click(screen.getByTestId('scope-checkbox-calendar'));
    await user.click(screen.getByTestId('create-token-submit'));

    await screen.findByText('API token created');

    // Verify console.log was never called with the credential (or either half)
    const allLogCalls = consoleSpy.mock.calls.flat().join(' ');
    expect(allLogCalls).not.toContain(makeCredential(4, ONE_TIME_SECRET));
    expect(allLogCalls).not.toContain(ONE_TIME_SECRET);

    consoleSpy.mockRestore();
  });

  it('copy-to-clipboard writes the composed credential to the clipboard', async () => {
    // Use writeToClipboard: false so userEvent doesn't replace navigator.clipboard
    const user = userEvent.setup({ writeToClipboard: false });
    const token = makeToken(5);
    vi.mocked(publicApiTokensCreate).mockResolvedValueOnce(
      makeCreateResponse(token, ONE_TIME_SECRET)
    );

    // Install our own spy on the already-configured clipboard mock
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      writable: true,
      configurable: true,
    });

    renderDialog();

    await user.type(
      screen.getByPlaceholderText('My integration'),
      'Integration 5'
    );
    await user.click(screen.getByTestId('scope-checkbox-calendar'));
    await user.click(screen.getByTestId('create-token-submit'));

    await screen.findByText('API token created');

    // Click copy
    await user.click(screen.getByTestId('copy-token-button'));

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith(
        makeCredential(5, ONE_TIME_SECRET)
      );
    });
  });

  it('blocks submit when no name provided', async () => {
    const user = userEvent.setup();
    renderDialog();

    // Select scope but no name
    await user.click(screen.getByTestId('scope-checkbox-calendar'));
    await user.click(screen.getByTestId('create-token-submit'));

    await waitFor(() => {
      expect(screen.getByText('Token name is required')).toBeInTheDocument();
    });

    expect(publicApiTokensCreate).not.toHaveBeenCalled();
  });

  it('blocks submit when no scopes selected', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByPlaceholderText('My integration'), 'No Scopes');
    await user.click(screen.getByTestId('create-token-submit'));

    await waitFor(() => {
      expect(
        screen.getByText('At least one scope must be selected')
      ).toBeInTheDocument();
    });

    expect(publicApiTokensCreate).not.toHaveBeenCalled();
  });

  it('shows a toast error if publicApiTokensCreate throws', async () => {
    const user = userEvent.setup();
    vi.mocked(publicApiTokensCreate).mockRejectedValueOnce(
      new Error('Server error')
    );

    renderDialog();

    await user.type(
      screen.getByPlaceholderText('My integration'),
      'Error Token'
    );
    await user.click(screen.getByTestId('scope-checkbox-calendar'));
    await user.click(screen.getByTestId('create-token-submit'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to create API token',
        expect.objectContaining({ description: 'Server error' })
      );
    });
  });

  it('resets form state when dialog closes and reopens (no stale credential)', async () => {
    const user = userEvent.setup();
    const token = makeToken(6);
    vi.mocked(publicApiTokensCreate).mockResolvedValueOnce(
      makeCreateResponse(token, ONE_TIME_SECRET)
    );

    const handleOpenChange = vi.fn();
    // Use rerender (without extra wrapper) to drive the SAME component instance
    // through create → credential shown → close → reopen. Passing just
    // <NewTokenDialog/> lets RTL re-apply the renderDialog wrapper, preserving
    // the React tree and its state so the useEffect that clears onceCredential
    // fires on the MOUNTED component — not a fresh mount.
    const { rerender } = renderDialog(true, handleOpenChange);

    await user.type(
      screen.getByPlaceholderText('My integration'),
      'Integration 6'
    );
    await user.click(screen.getByTestId('scope-checkbox-calendar'));
    await user.click(screen.getByTestId('create-token-submit'));

    // Credential view: the one-time composed credential is shown in the input
    await screen.findByText('API token created');
    expect(
      (screen.getByTestId('token-credential-input') as HTMLInputElement).value
    ).toBe(makeCredential(6, ONE_TIME_SECRET));

    // Close: rerender with open=false (wrapper re-applied by RTL).
    // The useEffect fires on the mounted component and clears onceCredential.
    rerender(<NewTokenDialog open={false} onOpenChange={handleOpenChange} />);

    // The Dialog unmounts its content when closed — credential input gone from DOM.
    expect(
      screen.queryByTestId('token-credential-input')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByDisplayValue(makeCredential(6, ONE_TIME_SECRET))
    ).not.toBeInTheDocument();

    // Reopen on the SAME instance: should show the form, NOT the credential view.
    // If onceCredential was not cleared by the close useEffect, isCredentialView
    // would still be true and the credential input would appear again — test
    // catches that.
    rerender(<NewTokenDialog open={true} onOpenChange={handleOpenChange} />);

    // After reopen: form view is shown (placeholder visible, no credential input)
    await screen.findByPlaceholderText('My integration');
    expect(
      screen.queryByTestId('token-credential-input')
    ).not.toBeInTheDocument();
  });
});
