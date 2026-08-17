import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';

// --- Mocks ------------------------------------------------------------------

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

import {
  PermissionProvider,
  PermissionGate,
  useRequirePermission,
  usePermissions,
  PERMISSIONS,
} from './permission-gate';

// Capability arrays standing in for the old 'admin' / 'member' roles.
const ADMIN_PERMISSIONS = [
  PERMISSIONS.manageMembers,
  PERMISSIONS.manageOrganization,
  PERMISSIONS.manageBranding,
  PERMISSIONS.manageBilling,
];
const MEMBER_PERMISSIONS: string[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithPermissions(
  permissions: readonly string[] | null,
  ui: ReactNode
) {
  return render(
    <PermissionProvider permissions={permissions}>{ui}</PermissionProvider>
  );
}

// A minimal consumer that calls useRequirePermission and renders a label.
function RequirePermissionConsumer({
  required,
  redirectTo,
}: {
  required: string;
  redirectTo?: string;
}) {
  const { isAllowed } = useRequirePermission(required, redirectTo);
  return <div data-testid='consumer'>{isAllowed ? 'allowed' : 'denied'}</div>;
}

// A minimal consumer that reads the raw permissions value.
function PermissionsConsumer() {
  const permissions = usePermissions();
  return (
    <div data-testid='permissions'>
      {permissions === null ? 'null' : permissions.join(',')}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PermissionGate tests
// ---------------------------------------------------------------------------

describe('PermissionGate', () => {
  it('renders children when the capability is present', () => {
    renderWithPermissions(
      ADMIN_PERMISSIONS,
      <PermissionGate permission={PERMISSIONS.manageMembers}>
        <span>admin content</span>
      </PermissionGate>
    );
    expect(screen.getByText('admin content')).toBeInTheDocument();
  });

  it('hides children when the capability is absent', () => {
    renderWithPermissions(
      MEMBER_PERMISSIONS,
      <PermissionGate permission={PERMISSIONS.manageMembers}>
        <span>admin content</span>
      </PermissionGate>
    );
    expect(screen.queryByText('admin content')).not.toBeInTheDocument();
  });

  it('renders fallback when the capability is absent', () => {
    renderWithPermissions(
      MEMBER_PERMISSIONS,
      <PermissionGate
        permission={PERMISSIONS.manageMembers}
        fallback={<span>no access</span>}
      >
        <span>admin content</span>
      </PermissionGate>
    );
    expect(screen.getByText('no access')).toBeInTheDocument();
    expect(screen.queryByText('admin content')).not.toBeInTheDocument();
  });

  it('renders children for a member when they hold the required capability', () => {
    renderWithPermissions(
      [PERMISSIONS.manageBilling],
      <PermissionGate permission={PERMISSIONS.manageBilling}>
        <span>billing content</span>
      </PermissionGate>
    );
    expect(screen.getByText('billing content')).toBeInTheDocument();
  });

  it('hides content gated on a capability the member lacks', () => {
    renderWithPermissions(
      MEMBER_PERMISSIONS,
      <PermissionGate permission={PERMISSIONS.manageBilling}>
        <span>billing content</span>
      </PermissionGate>
    );
    expect(screen.queryByText('billing content')).not.toBeInTheDocument();
  });

  it('renders nothing (no fallback) when the capability is absent', () => {
    const { container } = renderWithPermissions(
      MEMBER_PERMISSIONS,
      <PermissionGate permission={PERMISSIONS.manageMembers}>
        <span>admin content</span>
      </PermissionGate>
    );
    // No children, no fallback — container should be effectively empty.
    expect(container.textContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// useRequirePermission tests
// ---------------------------------------------------------------------------

describe('useRequirePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not redirect when the capability is present', () => {
    renderWithPermissions(
      ADMIN_PERMISSIONS,
      <RequirePermissionConsumer required={PERMISSIONS.manageMembers} />
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('consumer')).toHaveTextContent('allowed');
  });

  it('redirects to "/" (default) when a member lacks the capability', async () => {
    renderWithPermissions(
      MEMBER_PERMISSIONS,
      <RequirePermissionConsumer required={PERMISSIONS.manageMembers} />
    );
    // useEffect is async — wait for it.
    await act(async () => {});
    expect(replace).toHaveBeenCalledWith('/');
    expect(screen.getByTestId('consumer')).toHaveTextContent('denied');
  });

  it('redirects to the custom redirectTo when the capability is absent', async () => {
    renderWithPermissions(
      MEMBER_PERMISSIONS,
      <RequirePermissionConsumer
        required={PERMISSIONS.manageMembers}
        redirectTo='/dashboard'
      />
    );
    await act(async () => {});
    expect(replace).toHaveBeenCalledWith('/dashboard');
  });

  it('does not redirect while permissions are null (loading)', async () => {
    renderWithPermissions(
      null,
      <RequirePermissionConsumer required={PERMISSIONS.manageMembers} />
    );
    await act(async () => {});
    expect(replace).not.toHaveBeenCalled();
  });

  it('returns isAllowed=false when permissions are null', () => {
    renderWithPermissions(
      null,
      <RequirePermissionConsumer required={PERMISSIONS.manageMembers} />
    );
    expect(screen.getByTestId('consumer')).toHaveTextContent('denied');
  });
});

// ---------------------------------------------------------------------------
// usePermissions tests
// ---------------------------------------------------------------------------

describe('usePermissions', () => {
  it('returns the permissions from the nearest PermissionProvider', () => {
    renderWithPermissions(ADMIN_PERMISSIONS, <PermissionsConsumer />);
    expect(screen.getByTestId('permissions')).toHaveTextContent(
      ADMIN_PERMISSIONS.join(',')
    );
  });

  it('returns null when no PermissionProvider is present', () => {
    render(<PermissionsConsumer />);
    expect(screen.getByTestId('permissions')).toHaveTextContent('null');
  });
});
