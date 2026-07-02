import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BookingPoliciesPage from './page';
import * as roleGateModule from '@/components/navigation/role-gate';

vi.spyOn(roleGateModule, 'useRequireRole').mockImplementation(() => ({
  isAllowed: true,
}));

// The table pulls in the DataTableQueryBoundary + several data hooks; stub it so
// the page test stays focused on the admin gate + toolbar wiring.
vi.mock('@/components/booking-policies/booking-policies-table', () => ({
  BookingPoliciesTable: ({
    toolbarActions,
  }: {
    toolbarActions?: React.ReactNode;
  }) => <div data-testid='booking-policies-table'>{toolbarActions}</div>,
}));

vi.mock('@/components/booking-policies/booking-policy-dialog', () => ({
  BookingPolicyDialog: () => <div data-testid='booking-policy-dialog' />,
}));

function renderPage() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<BookingPoliciesPage />, { wrapper });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('BookingPoliciesPage', () => {
  it('renders the page and the New policy action when the user is admin', () => {
    vi.mocked(roleGateModule.useRequireRole).mockReturnValue({
      isAllowed: true,
    });

    renderPage();

    expect(screen.getByText('Booking policies')).toBeInTheDocument();
    expect(screen.getByTestId('booking-policies-table')).toBeInTheDocument();
    expect(screen.getByTestId('new-booking-policy-button')).toBeInTheDocument();
  });

  it('returns null when the user is not admin', () => {
    vi.mocked(roleGateModule.useRequireRole).mockReturnValue({
      isAllowed: false,
    });

    const { container } = renderPage();

    expect(container.innerHTML).toBe('');
  });
});
