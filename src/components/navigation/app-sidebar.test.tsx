/**
 * AppSidebar — account/logout tests.
 *
 * Covers the real user/org info surface and the logout affordance added to the
 * account menu.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppSidebar } from './app-sidebar';
import { PermissionProvider, PERMISSIONS } from './permission-gate';

// Capability arrays standing in for the old 'admin' / 'member' roles.
const ADMIN_PERMISSIONS = [
  PERMISSIONS.manageMembers,
  PERMISSIONS.manageOrganization,
  PERMISSIONS.manageBranding,
  PERMISSIONS.manageBilling,
];
const MEMBER_PERMISSIONS: string[] = [];

let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

beforeEach(() => {
  mockPathname = '/';
});

function renderWithPermissions(permissions: readonly string[] | null) {
  return render(
    <PermissionProvider permissions={permissions}>
      <AppSidebar groups={[{ items: [] }]} />
    </PermissionProvider>
  );
}

beforeAll(() => {
  // Radix DropdownMenu uses ResizeObserver + pointer APIs under jsdom.
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // jsdom lacks these Element methods Radix calls on the trigger.
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {};
  }
});

describe('AppSidebar — account', () => {
  it('renders the real user name, email and org name', () => {
    render(
      <AppSidebar
        groups={[{ items: [] }]}
        orgName='Acme Inc'
        orgMeta='Admin'
        userName='Jane Doe'
        userEmail='jane@acme.test'
        userInitials='JD'
      />
    );

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@acme.test')).toBeInTheDocument();
    expect(screen.getByText('Acme Inc')).toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('calls onLogout when "Log out" is selected from the account menu', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();

    render(
      <AppSidebar
        groups={[{ items: [] }]}
        userName='Jane Doe'
        userEmail='jane@acme.test'
        userInitials='JD'
        onLogout={onLogout}
      />
    );

    await user.click(screen.getByRole('button', { name: /account menu/i }));

    const logoutItem = await screen.findByRole('menuitem', {
      name: /log out/i,
    });
    await user.click(logoutItem);

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('AppSidebar — billing nav', () => {
  it('renders every billing item, including the Ledger, for an admin', () => {
    renderWithPermissions(ADMIN_PERMISSIONS);

    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/billing'
    );
    expect(screen.getByRole('link', { name: 'Plans' })).toHaveAttribute(
      'href',
      '/billing/plans'
    );
    expect(screen.getByRole('link', { name: 'Statements' })).toHaveAttribute(
      'href',
      '/billing/periods'
    );
    expect(screen.getByRole('link', { name: 'Ledger' })).toHaveAttribute(
      'href',
      '/billing/occurrences'
    );
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/billing/profile'
    );
  });

  it('hides the admin-only Ledger from a member but keeps the read items', () => {
    renderWithPermissions(MEMBER_PERMISSIONS);

    // Reads stay visible to members.
    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plans' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Statements' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();

    // The ledger is billing-owner/admin gated — hidden from a plain member.
    expect(
      screen.queryByRole('link', { name: 'Ledger' })
    ).not.toBeInTheDocument();
  });

  it('hides the Ledger while the role is still unresolved (null)', () => {
    renderWithPermissions(null);

    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Ledger' })
    ).not.toBeInTheDocument();
  });
});

describe('AppSidebar — billing active state (most-specific wins)', () => {
  // SidebarItem marks the active row with aria-current="page".
  it('activates only Overview on /billing, not the nested items', () => {
    mockPathname = '/billing';
    renderWithPermissions(ADMIN_PERMISSIONS);

    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    for (const name of ['Plans', 'Statements', 'Ledger', 'Profile']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute(
        'aria-current'
      );
    }
  });

  it('activates only Plans on /billing/plans, and never Overview', () => {
    mockPathname = '/billing/plans';
    renderWithPermissions(ADMIN_PERMISSIONS);

    expect(screen.getByRole('link', { name: 'Plans' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute(
      'aria-current'
    );
    for (const name of ['Statements', 'Ledger', 'Profile']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute(
        'aria-current'
      );
    }
  });

  it('activates only the Ledger on /billing/occurrences', () => {
    mockPathname = '/billing/occurrences';
    renderWithPermissions(ADMIN_PERMISSIONS);

    expect(screen.getByRole('link', { name: 'Ledger' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('keeps parent-highlights-child for a deep non-nested route (/billing/periods/123 → Statements)', () => {
    mockPathname = '/billing/periods/123';
    renderWithPermissions(ADMIN_PERMISSIONS);

    expect(screen.getByRole('link', { name: 'Statements' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute(
      'aria-current'
    );
  });
});
