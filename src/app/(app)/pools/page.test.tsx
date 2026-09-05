import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PoolsPage from './page';
import * as roleGateModule from '@/components/navigation/permission-gate';

vi.spyOn(roleGateModule, 'useRequirePermission').mockImplementation(() => ({
  isAllowed: true,
}));

// The table pulls in the DataTableQueryBoundary and several data hooks; stub it
// so this test stays on the admin gate + toolbar wiring.
vi.mock('@/components/calendar-pools/pools-table', () => ({
  PoolsTable: ({ toolbarActions }: { toolbarActions?: React.ReactNode }) => (
    <div data-testid='pools-table'>{toolbarActions}</div>
  ),
}));

vi.mock('@/components/calendar-pools/pool-dialog', () => ({
  PoolDialog: () => <div data-testid='pool-dialog' />,
}));

function renderPage() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<PoolsPage />, { wrapper });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('PoolsPage', () => {
  it('renders the page and the New pool action for an admin', () => {
    vi.mocked(roleGateModule.useRequirePermission).mockReturnValue({
      isAllowed: true,
    });

    renderPage();

    expect(screen.getByText('Calendar pools')).toBeInTheDocument();
    expect(screen.getByTestId('pools-table')).toBeInTheDocument();
    expect(screen.getByTestId('new-pool-button')).toBeInTheDocument();
  });

  it('renders nothing for a non-admin, who has no pool write to make', () => {
    vi.mocked(roleGateModule.useRequirePermission).mockReturnValue({
      isAllowed: false,
    });

    const { container } = renderPage();

    expect(container.innerHTML).toBe('');
  });
});
