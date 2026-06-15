/**
 * CreateOrganizationDialog tests.
 *
 * Covers:
 * - Renders dialog with name input and submit button when open
 * - Submitting a valid name calls createOrganization with { name }
 * - Submitting an empty name is blocked by zod validation (no create call)
 * - On successful create, onCreated fires with the created org
 * - Shows error alert when the API call fails
 * - Dialog closes (onOpenChange(false)) when Cancel is clicked
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { Organization } from '@/client';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    organizationsCreate: vi.fn(),
  };
});

import { organizationsCreate } from '@/client/sdk.gen';
import { CreateOrganizationDialog } from './create-organization-dialog';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NEW_ORG: Organization = {
  id: 42,
  name: 'New Org',
  google_service_account: null,
  created: '2026-01-01T00:00:00Z',
  modified: '2026-01-01T00:00:00Z',
};

function makeSuccessResponse(
  org: Organization
): Awaited<ReturnType<typeof organizationsCreate>> {
  return {
    data: org,
    response: new Response(JSON.stringify(org), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof organizationsCreate>>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }
  return { Wrapper, queryClient };
}

function renderDialog(
  overrides: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onCreated?: (org: Organization) => void;
  } = {}
) {
  const { Wrapper } = makeQueryWrapper();
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  const onCreated = overrides.onCreated ?? vi.fn();

  const result = render(
    createElement(
      Wrapper,
      null,
      createElement(CreateOrganizationDialog, {
        open: overrides.open ?? true,
        onOpenChange,
        onCreated,
      })
    )
  );

  return { ...result, onOpenChange, onCreated };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateOrganizationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Renders when open
  // -------------------------------------------------------------------------

  it('renders the organization name input when open', () => {
    renderDialog({ open: true });
    expect(
      screen.getByRole('textbox', { name: /organization name/i })
    ).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    renderDialog({ open: true });
    expect(
      screen.getByRole('button', { name: /create organization/i })
    ).toBeInTheDocument();
  });

  it('renders a Cancel button', () => {
    renderDialog({ open: true });
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('does not render the dialog when open is false', () => {
    renderDialog({ open: false });
    expect(
      screen.queryByRole('textbox', { name: /organization name/i })
    ).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Validation — empty name is blocked
  // -------------------------------------------------------------------------

  it('does NOT call createOrganization when name is empty', async () => {
    vi.mocked(organizationsCreate).mockResolvedValue(
      makeSuccessResponse(NEW_ORG)
    );
    const user = userEvent.setup();
    renderDialog();

    const submitButton = screen.getByRole('button', {
      name: /create organization/i,
    });
    await user.click(submitButton);

    // zod validation should block the submission
    await waitFor(() => {
      expect(
        screen.getByText(/organization name is required/i)
      ).toBeInTheDocument();
    });

    expect(organizationsCreate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Successful submission
  // -------------------------------------------------------------------------

  it('calls createOrganization with { name } on valid submit', async () => {
    vi.mocked(organizationsCreate).mockResolvedValue(
      makeSuccessResponse(NEW_ORG)
    );
    const user = userEvent.setup();
    renderDialog();

    const input = screen.getByRole('textbox', { name: /organization name/i });
    await user.type(input, 'New Org');

    const submitButton = screen.getByRole('button', {
      name: /create organization/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(organizationsCreate).toHaveBeenCalledOnce();
    });

    const callArg = vi.mocked(organizationsCreate).mock.calls[0][0] as {
      body: { name: string };
    };
    expect(callArg.body).toMatchObject({ name: 'New Org' });
  });

  it('calls onCreated with the created org on success', async () => {
    vi.mocked(organizationsCreate).mockResolvedValue(
      makeSuccessResponse(NEW_ORG)
    );
    const user = userEvent.setup();
    const onCreated = vi.fn();
    renderDialog({ onCreated });

    const input = screen.getByRole('textbox', { name: /organization name/i });
    await user.type(input, 'New Org');

    const submitButton = screen.getByRole('button', {
      name: /create organization/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledOnce();
    });
    expect(onCreated).toHaveBeenCalledWith(NEW_ORG);
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it('shows an error alert when createOrganization fails', async () => {
    vi.mocked(organizationsCreate).mockRejectedValue(
      new Error('Internal Server Error')
    );
    const user = userEvent.setup();
    renderDialog();

    const input = screen.getByRole('textbox', { name: /organization name/i });
    await user.type(input, 'Fail Org');

    const submitButton = screen.getByRole('button', {
      name: /create organization/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/could not create organization/i)
      ).toBeInTheDocument();
    });

    expect(organizationsCreate).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Cancel button
  // -------------------------------------------------------------------------

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
