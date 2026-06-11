import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';

// --- Mocks ------------------------------------------------------------------

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

import { RoleProvider, RoleGate, useRequireRole, useRole } from './role-gate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithRole(role: 'admin' | 'member' | null, ui: ReactNode) {
  return render(<RoleProvider role={role}>{ui}</RoleProvider>);
}

// A minimal consumer that calls useRequireRole and renders a label.
function RequireRoleConsumer({
  required,
  redirectTo,
}: {
  required: 'admin' | 'member';
  redirectTo?: string;
}) {
  const { isAllowed } = useRequireRole(required, redirectTo);
  return <div data-testid='consumer'>{isAllowed ? 'allowed' : 'denied'}</div>;
}

// A minimal consumer that reads the raw role value.
function RoleConsumer() {
  const role = useRole();
  return <div data-testid='role'>{role ?? 'null'}</div>;
}

// ---------------------------------------------------------------------------
// RoleGate tests
// ---------------------------------------------------------------------------

describe('RoleGate', () => {
  it('renders children when role matches', () => {
    renderWithRole(
      'admin',
      <RoleGate role='admin'>
        <span>admin content</span>
      </RoleGate>
    );
    expect(screen.getByText('admin content')).toBeInTheDocument();
  });

  it('hides children when role does not match', () => {
    renderWithRole(
      'member',
      <RoleGate role='admin'>
        <span>admin content</span>
      </RoleGate>
    );
    expect(screen.queryByText('admin content')).not.toBeInTheDocument();
  });

  it('renders fallback when role does not match', () => {
    renderWithRole(
      'member',
      <RoleGate role='admin' fallback={<span>no access</span>}>
        <span>admin content</span>
      </RoleGate>
    );
    expect(screen.getByText('no access')).toBeInTheDocument();
    expect(screen.queryByText('admin content')).not.toBeInTheDocument();
  });

  it('renders member content for a member user', () => {
    renderWithRole(
      'member',
      <RoleGate role='member'>
        <span>member content</span>
      </RoleGate>
    );
    expect(screen.getByText('member content')).toBeInTheDocument();
  });

  it('hides member content from an admin user', () => {
    renderWithRole(
      'admin',
      <RoleGate role='member'>
        <span>member content</span>
      </RoleGate>
    );
    expect(screen.queryByText('member content')).not.toBeInTheDocument();
  });

  it('renders nothing (no fallback) when role does not match', () => {
    const { container } = renderWithRole(
      'member',
      <RoleGate role='admin'>
        <span>admin content</span>
      </RoleGate>
    );
    // No children, no fallback — container should be effectively empty.
    expect(container.textContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// useRequireRole tests
// ---------------------------------------------------------------------------

describe('useRequireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not redirect when the role matches', () => {
    renderWithRole('admin', <RequireRoleConsumer required='admin' />);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('consumer')).toHaveTextContent('allowed');
  });

  it('redirects to "/" (default) when a member requires admin', async () => {
    renderWithRole('member', <RequireRoleConsumer required='admin' />);
    // useEffect is async — wait for it.
    await act(async () => {});
    expect(replace).toHaveBeenCalledWith('/');
    expect(screen.getByTestId('consumer')).toHaveTextContent('denied');
  });

  it('redirects to the custom redirectTo when role does not match', async () => {
    renderWithRole(
      'member',
      <RequireRoleConsumer required='admin' redirectTo='/dashboard' />
    );
    await act(async () => {});
    expect(replace).toHaveBeenCalledWith('/dashboard');
  });

  it('does not redirect while role is null (loading)', async () => {
    renderWithRole(null, <RequireRoleConsumer required='admin' />);
    await act(async () => {});
    expect(replace).not.toHaveBeenCalled();
  });

  it('returns isAllowed=false when role is null', () => {
    renderWithRole(null, <RequireRoleConsumer required='admin' />);
    expect(screen.getByTestId('consumer')).toHaveTextContent('denied');
  });
});

// ---------------------------------------------------------------------------
// useRole tests
// ---------------------------------------------------------------------------

describe('useRole', () => {
  it('returns the role from the nearest RoleProvider', () => {
    renderWithRole('admin', <RoleConsumer />);
    expect(screen.getByTestId('role')).toHaveTextContent('admin');
  });

  it('returns null when no RoleProvider is present', () => {
    render(<RoleConsumer />);
    expect(screen.getByTestId('role')).toHaveTextContent('null');
  });
});
