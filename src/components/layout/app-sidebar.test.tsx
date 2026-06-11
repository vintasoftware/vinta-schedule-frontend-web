/**
 * AppSidebar — account/logout tests.
 *
 * Covers the real user/org info surface and the logout affordance added to the
 * account menu.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppSidebar } from './app-sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

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
