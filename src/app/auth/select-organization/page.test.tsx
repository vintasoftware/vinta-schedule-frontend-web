import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any module imports that reference them.
// ---------------------------------------------------------------------------

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

// Mock useActiveOrganization so we control every return value branch.
const mockUseActiveOrganization = vi.fn();
vi.mock('@/hooks/organizations/use-active-organization', () => ({
  useActiveOrganization: (...args: unknown[]) =>
    mockUseActiveOrganization(...args),
}));

import SelectOrganizationPage from './page';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MEMBERSHIP_A = {
  organization: { id: 1, name: 'Acme Corp' },
  role: 'admin' as const,
};

const MEMBERSHIP_B = {
  organization: { id: 2, name: 'Globex' },
  role: 'member' as const,
};

const MEMBERSHIP_SINGLE = {
  organization: { id: 3, name: 'Solo Org' },
  role: 'member' as const,
};

function baseReturn(
  overrides: Partial<ReturnType<typeof mockUseActiveOrganization>>
) {
  const mockSetActive = vi.fn();
  return {
    memberships: [],
    activeMembership: null,
    isGated: false,
    isLoading: false,
    needsSelection: false,
    setActive: mockSetActive,
    ...overrides,
  };
}

function renderPage() {
  return render(<SelectOrganizationPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SelectOrganizationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when loading', () => {
    it('renders a loading state without crashing', () => {
      mockUseActiveOrganization.mockReturnValue(
        baseReturn({ isLoading: true, memberships: [] })
      );
      renderPage();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
      // No redirect while loading.
      expect(replace).not.toHaveBeenCalled();
    });
  });

  describe('when mine/ query errors (isError = true)', () => {
    it('renders a neutral loading state and does NOT redirect', async () => {
      // A transient mine/ error causes memberships=[] which would normally
      // trigger isGated=true → /auth/onboarding. The isError guard must
      // suppress both redirect effects so a real multi-org user is not
      // incorrectly sent to onboarding.
      mockUseActiveOrganization.mockReturnValue(
        baseReturn({
          isError: true,
          isLoading: false,
          isGated: true, // memberships=[] looks gated — must be ignored
          memberships: [],
          needsSelection: false,
        })
      );
      renderPage();

      // Neutral loading card is shown.
      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      // Picker heading must NOT appear.
      expect(
        screen.queryByRole('heading', { name: /choose an organization/i })
      ).not.toBeInTheDocument();

      // Neither redirect must have fired.
      // Use a short waitFor to let any accidental effect flush.
      await waitFor(() => {
        expect(replace).not.toHaveBeenCalledWith('/auth/onboarding');
        expect(replace).not.toHaveBeenCalledWith('/');
      });
    });
  });

  describe('when gated (0 orgs)', () => {
    it('redirects to /auth/onboarding', async () => {
      mockUseActiveOrganization.mockReturnValue(
        baseReturn({ isGated: true, memberships: [], needsSelection: false })
      );
      renderPage();
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/auth/onboarding');
      });
      // Picker must not be shown while redirecting.
      expect(
        screen.queryByRole('heading', { name: /choose an organization/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('when already has a valid selection (needsSelection = false)', () => {
    it('redirects to / for a user with an active membership', async () => {
      mockUseActiveOrganization.mockReturnValue(
        baseReturn({
          memberships: [MEMBERSHIP_A, MEMBERSHIP_B],
          activeMembership: MEMBERSHIP_A,
          needsSelection: false,
          isGated: false,
        })
      );
      renderPage();
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/');
      });
      // Picker must not be shown while redirecting.
      expect(
        screen.queryByRole('heading', { name: /choose an organization/i })
      ).not.toBeInTheDocument();
    });

    it('redirects to / for a single-org user (auto-selected by Phase 3a)', async () => {
      mockUseActiveOrganization.mockReturnValue(
        baseReturn({
          memberships: [MEMBERSHIP_SINGLE],
          activeMembership: MEMBERSHIP_SINGLE,
          needsSelection: false,
          isGated: false,
        })
      );
      renderPage();
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/');
      });
      // Picker must not be shown while redirecting.
      expect(
        screen.queryByRole('heading', { name: /choose an organization/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('when needsSelection is true (multi-org, no valid stored selection)', () => {
    it('renders one selectable option per membership', () => {
      mockUseActiveOrganization.mockReturnValue(
        baseReturn({
          memberships: [MEMBERSHIP_A, MEMBERSHIP_B],
          activeMembership: null,
          isGated: false,
          isLoading: false,
          needsSelection: true,
        })
      );
      renderPage();

      // Heading is visible.
      expect(
        screen.getByRole('heading', { name: /choose an organization/i })
      ).toBeInTheDocument();

      // One button per membership, labelled by org name.
      expect(
        screen.getByRole('button', { name: /acme corp/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /globex/i })
      ).toBeInTheDocument();

      // Role badges rendered.
      expect(screen.getByText('admin')).toBeInTheDocument();
      expect(screen.getByText('member')).toBeInTheDocument();
    });

    it('calls setActive with String(org.id) and redirects to / when an org is clicked', async () => {
      const mockSetActive = vi.fn();
      mockUseActiveOrganization.mockReturnValue(
        baseReturn({
          memberships: [MEMBERSHIP_A, MEMBERSHIP_B],
          activeMembership: null,
          isGated: false,
          isLoading: false,
          needsSelection: true,
          setActive: mockSetActive,
        })
      );
      renderPage();

      // Click the first org button.
      fireEvent.click(screen.getByRole('button', { name: /acme corp/i }));

      // setActive called with the stringified org id.
      expect(mockSetActive).toHaveBeenCalledWith('1');

      // router.replace called with '/'.
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/');
      });
    });

    it('calls setActive with the correct id when the second org is clicked', () => {
      const mockSetActive = vi.fn();
      mockUseActiveOrganization.mockReturnValue(
        baseReturn({
          memberships: [MEMBERSHIP_A, MEMBERSHIP_B],
          activeMembership: null,
          isGated: false,
          isLoading: false,
          needsSelection: true,
          setActive: mockSetActive,
        })
      );
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: /globex/i }));

      expect(mockSetActive).toHaveBeenCalledWith('2');
    });
  });
});
