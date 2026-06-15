import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — declared before any module imports that reference them.
// ---------------------------------------------------------------------------

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

// Mock useCreateOrganization so we can control the resolved Organization value
// and assert call order relative to setActive.
const mockCreateOrganization = vi.fn();
const mockCreateOrganizationMutation = { isPending: false };
vi.mock('@/hooks/organizations/use-create-organization', () => ({
  useCreateOrganization: () => ({
    createOrganization: mockCreateOrganization,
    createOrganizationMutation: mockCreateOrganizationMutation,
  }),
}));

// Mock useActiveOrganization so we can assert setActive is called with the
// correct id returned from createOrganization (UC4a — prime X-Organization-Id
// before entering the app).
const mockSetActive = vi.fn();
vi.mock('@/hooks/organizations/use-active-organization', () => ({
  useActiveOrganization: () => ({
    setActive: mockSetActive,
    memberships: [],
    isGated: true,
    isLoading: false,
    isError: false,
    needsSelection: false,
    activeOrganizationId: null,
    activeMembership: null,
    isMultiOrg: false,
  }),
}));

import OnboardingPage from './page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderPage() {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<OnboardingPage />, { wrapper });
}

async function fillNameAndSubmit(name: string) {
  const input = screen.getByRole('textbox', { name: /organization name/i });
  fireEvent.change(input, { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: /create organization/i }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form heading and submit button', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /create your organization/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create organization/i })
    ).toBeInTheDocument();
  });

  it('blocks submission when name is empty (client-side validation)', async () => {
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: /create organization/i })
    );
    // Validation message appears; mutation was never called.
    expect(
      await screen.findByText(/organization name is required/i)
    ).toBeInTheDocument();
    expect(mockCreateOrganization).not.toHaveBeenCalled();
    expect(mockSetActive).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  describe('successful submission (UC4a)', () => {
    const CREATED_ORG = { id: 42, name: 'Test Co' };

    beforeEach(() => {
      mockCreateOrganization.mockResolvedValue(CREATED_ORG);
    });

    it('calls createOrganization with the entered name', async () => {
      renderPage();
      await fillNameAndSubmit('Test Co');
      await waitFor(() =>
        expect(mockCreateOrganization).toHaveBeenCalledWith({ name: 'Test Co' })
      );
    });

    it('calls setActive with String(newOrg.id) after createOrganization resolves', async () => {
      renderPage();
      await fillNameAndSubmit('Test Co');
      await waitFor(() => expect(mockSetActive).toHaveBeenCalledWith('42'));
    });

    it('calls setActive BEFORE router.replace so X-Organization-Id is primed on entry', async () => {
      // Verify ordering: setActive must be invoked before replace('/').
      const callOrder: string[] = [];
      mockSetActive.mockImplementation(() => {
        callOrder.push('setActive');
      });
      replace.mockImplementation(() => {
        callOrder.push('replace');
      });

      renderPage();
      await fillNameAndSubmit('Test Co');

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));

      expect(callOrder).toEqual(['setActive', 'replace']);
    });

    it('redirects to / after setActive', async () => {
      renderPage();
      await fillNameAndSubmit('Test Co');
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    });
  });

  describe('failed submission', () => {
    it('shows an error alert when createOrganization rejects', async () => {
      mockCreateOrganization.mockRejectedValue(new Error('Server error'));
      renderPage();
      await fillNameAndSubmit('Bad Org');

      expect(await screen.findByText(/server error/i)).toBeInTheDocument();

      // Neither setActive nor redirect should have fired.
      expect(mockSetActive).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    });
  });
});
