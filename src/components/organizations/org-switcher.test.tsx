import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MyMembership } from '@/client';
import { OrgSwitcher } from './org-switcher';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// next/navigation is required by app-sidebar (used transitively). The switcher
// itself doesn't use it, but jsdom needs the mock to avoid module errors.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MEMBERSHIP_ALPHA: MyMembership = {
  organization: { id: 1, name: 'Alpha Corp' },
  role: 'admin',
};

const MEMBERSHIP_BETA: MyMembership = {
  organization: { id: 2, name: 'Beta Ltd' },
  role: 'member',
};

const MEMBERSHIP_GAMMA: MyMembership = {
  organization: { id: 3, name: 'Gamma Inc' },
  role: 'member',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSwitcher(
  overrides: Partial<React.ComponentProps<typeof OrgSwitcher>> = {}
) {
  const onSelect = vi.fn();
  const onCreateOrg = vi.fn();

  const props = {
    memberships: [MEMBERSHIP_ALPHA, MEMBERSHIP_BETA],
    activeOrgId: '1',
    onSelect,
    onCreateOrg,
    ...overrides,
  };

  const result = render(<OrgSwitcher {...props} />);
  return { ...result, onSelect, onCreateOrg };
}

// Open the dropdown by clicking the trigger button. Returns when Radix has
// rendered the portal content.
async function openDropdown(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole('button');
  await user.click(trigger);
  // Wait for the dropdown items to be visible (Radix uses a portal).
  await waitFor(() => {
    // At minimum the "New organization" item must be present.
    expect(
      screen.getByRole('menuitem', { name: /new organization/i })
    ).toBeInTheDocument();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrgSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Trigger rendering
  // -------------------------------------------------------------------------

  describe('trigger', () => {
    it('shows the active org name in the trigger', () => {
      renderSwitcher({ activeOrgId: '1' });
      // The trigger button contains the org name text.
      expect(screen.getByText('Alpha Corp')).toBeInTheDocument();
    });

    it('shows the active org role in the trigger', () => {
      renderSwitcher({ activeOrgId: '1' });
      // Role is capitalised: "admin" → "Admin"
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    it('falls back gracefully when activeOrgId does not match any membership', () => {
      renderSwitcher({ activeOrgId: '999' });
      expect(screen.getByText('Organization')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Dropdown items — one row per membership
  // -------------------------------------------------------------------------

  describe('membership rows', () => {
    it('renders one row per membership with name and role', async () => {
      const user = userEvent.setup();
      renderSwitcher({
        memberships: [MEMBERSHIP_ALPHA, MEMBERSHIP_BETA, MEMBERSHIP_GAMMA],
        activeOrgId: '1',
      });
      await openDropdown(user);

      // All three org names must appear in the menu.
      expect(
        screen.getByRole('menuitem', { name: /alpha corp/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: /beta ltd/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: /gamma inc/i })
      ).toBeInTheDocument();
    });

    it('shows role labels for each membership', async () => {
      const user = userEvent.setup();
      renderSwitcher({
        memberships: [MEMBERSHIP_ALPHA, MEMBERSHIP_BETA],
        activeOrgId: '1',
      });
      await openDropdown(user);

      // "Admin" for ALPHA, "Member" for BETA — both must appear in the dropdown.
      const menuItems = screen.getAllByRole('menuitem');
      const itemTexts = menuItems.map((el) => el.textContent);
      const hasAdmin = itemTexts.some((t) => t?.includes('Admin'));
      const hasMember = itemTexts.some((t) => t?.includes('Member'));
      expect(hasAdmin).toBe(true);
      expect(hasMember).toBe(true);
    });

    it('marks the active membership with a checkmark icon', async () => {
      const user = userEvent.setup();
      renderSwitcher({ activeOrgId: '1' });
      await openDropdown(user);

      // The checkmark SVG is inside the Alpha Corp menu item. We look for a
      // visible check indicator — the lucide Check icon adds a path with a stroke.
      // The easiest assertion: the Alpha Corp row contains "Alpha Corp" and a
      // child svg; the Beta Ltd row does NOT.
      const alphaItem = screen.getByRole('menuitem', { name: /alpha corp/i });
      expect(alphaItem.querySelector('svg')).not.toBeNull();
    });

    it('does NOT mark the inactive memberships with a check', async () => {
      const user = userEvent.setup();
      renderSwitcher({ activeOrgId: '1' });
      await openDropdown(user);

      // Beta is not active; it should have no check svg child.
      const betaItem = screen.getByRole('menuitem', { name: /beta ltd/i });
      // The item might have an SVG for the avatar initial box, but NOT the Check icon.
      // We verify by checking that the active-check svg class (text-primary) is absent.
      expect(betaItem.innerHTML).not.toContain('text-primary');
    });
  });

  // -------------------------------------------------------------------------
  // Selection callback
  // -------------------------------------------------------------------------

  describe('onSelect callback', () => {
    it('calls onSelect with the string org id when a membership row is clicked', async () => {
      const user = userEvent.setup();
      const { onSelect } = renderSwitcher({ activeOrgId: '1' });
      await openDropdown(user);

      await user.click(screen.getByRole('menuitem', { name: /beta ltd/i }));

      expect(onSelect).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledWith('2');
    });

    it('passes org id as a string even though organization.id is a number', async () => {
      const user = userEvent.setup();
      const { onSelect } = renderSwitcher({ activeOrgId: '1' });
      await openDropdown(user);

      await user.click(screen.getByRole('menuitem', { name: /beta ltd/i }));

      const [calledWith] = onSelect.mock.calls[0] as [string];
      expect(typeof calledWith).toBe('string');
      expect(calledWith).toBe('2');
    });
  });

  // -------------------------------------------------------------------------
  // "+ New organization" item
  // -------------------------------------------------------------------------

  describe('New organization item', () => {
    it('calls onCreateOrg when the "+ New organization" item is clicked', async () => {
      const user = userEvent.setup();
      const { onCreateOrg } = renderSwitcher();
      await openDropdown(user);

      await user.click(
        screen.getByRole('menuitem', { name: /new organization/i })
      );

      expect(onCreateOrg).toHaveBeenCalledOnce();
    });

    it('renders a disabled "+ New organization" item when onCreateOrg is not provided', async () => {
      const user = userEvent.setup();
      renderSwitcher({ onCreateOrg: undefined });
      await openDropdown(user);

      const newOrgItem = screen.getByRole('menuitem', {
        name: /new organization/i,
      });
      // Radix sets aria-disabled on disabled items.
      expect(newOrgItem).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
