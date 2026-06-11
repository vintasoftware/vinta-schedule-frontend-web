import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import GroupsPage from './page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(() => '/groups'),
  useSearchParams: vi.fn(),
}));

// Mock the role gate
vi.mock('@/components/navigation/role-gate', () => ({
  useRequireRole: vi.fn(() => ({ isAllowed: true })),
}));

// Mock the SDK
vi.mock('@/client/sdk.gen', () => ({
  calendarGroupsList: vi.fn(),
}));

// Import after mocks are set up
import { useRequireRole } from '@/components/navigation/role-gate';

describe('GroupsPage', () => {
  let queryClient: QueryClient;
  let mockRouter: { replace: (path: string) => void };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockRouter = { replace: vi.fn() };
    vi.mocked(useRouter).mockReturnValue(
      mockRouter as ReturnType<typeof useRouter>
    );
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>
    );
  });

  it('shows "Calendar groups" header and description when admin', () => {
    vi.mocked(useRequireRole).mockReturnValue({
      isAllowed: true,
    } as unknown as ReturnType<typeof useRequireRole>);

    render(
      <QueryClientProvider client={queryClient}>
        <GroupsPage />
      </QueryClientProvider>
    );

    // Page header is visible
    const title = screen.getByText('Calendar groups');
    expect(title).toBeInTheDocument();

    const description = screen.getByText(
      'Manage your organization calendar groups.'
    );
    expect(description).toBeInTheDocument();
  });

  it('member is gated out of /groups', () => {
    // When the role gate returns isAllowed=false, the page returns null early.
    vi.mocked(useRequireRole).mockReturnValue({
      isAllowed: false,
    } as unknown as ReturnType<typeof useRequireRole>);

    render(
      <QueryClientProvider client={queryClient}>
        <GroupsPage />
      </QueryClientProvider>
    );

    // The page returns null, so nothing is rendered
    const title = screen.queryByText('Calendar groups');
    expect(title).not.toBeInTheDocument();
  });
});
